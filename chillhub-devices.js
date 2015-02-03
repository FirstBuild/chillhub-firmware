var serial = require('serialport');
var fs = require('fs');
var stream = require('binary-stream');
var sets = require('simplesets');

var _ = require("underscore");

var commons = require('./commons');
var parsers = require('./parsing');
var CronJob = require('cron').CronJob;
var attachments = {};

function ChillhubDevice(ttyPath, receive, announce) {
   var self = this;

   var ESC = 0xfe;
   var STX = 0xff;
   self.deviceType = '';
   self.UUID = '';
   self.subscriptions = new sets.Set([]);
   self.buf = [];
   self.msgBody = [];
   self.cronJobs = {};
   self.resources = {};
   self.registered = false;
   self.ignoreMsgCount = 10;

   self.uid = ttyPath;
   self.tty = new serial.SerialPort('/dev/'+ttyPath, { 
      baudrate: 115200, 
      disconnectedCallback: function(err) {
         if (err) {
            console.log('error in disconnectedCallback');
            console.log(err);
            console.log('UUID is ' + self.UUID);
         }
         if (self.resources.hasOwnProperty("setStatus")) {
            self.resources.setStatus("offline");
         } else {
            console.log("Could not set status, property setStatus not found.");
         }
      }
   });

   self.tty.open(function(err) {
      if (err) {
         console.log('error opening serial port');
         console.log(err);
         return;
      }

      self.tty.flush(function(err) {
         if (err) {
            console.log("Error flushing the serial port input buffer.");
            console.log(err);
            return;
         } 

         console.log("Serial port input buffer flushed.");

         self.scanForStx = function() {
            while (self.buf.length > 0) {
               var c = self.buf.shift();
               if (c == STX) {
                  self.commHandler = self.waitForLength;
                  self.waitForLength();
                  break;
               }
            }
         }

         self.waitForLength = function() {
            if (self.buf.length > 1) {
               if (self.buf[0] == ESC) {
                 self.buf.shift();
               }
               self.msgLen = self.buf.shift();
               self.bufIndex = 0;
               self.msgBody.length = 0;
               self.commHandler = self.waitForMessage;
               self.waitForMessage();
            }
         }

         self.waitForMessage = function() {
            while (self.buf.length > self.bufIndex) {
               if (self.buf[self.bufIndex] == ESC) {
                  if ((self.buf.length - self.bufIndex) > 1) {
                     self.bufIndex++;
                  } else {
                     return;
                  }
               }
               self.msgBody.push(self.buf[self.bufIndex++]);
               // wait for message plus sent checksum
               if (self.msgBody.length >= self.msgLen+2) {
                  self.checkMessage();
               }
            }
         }

         self.checkMessage= function() {
            var csSent = self.msgBody.pop() + self.msgBody.pop()*256;
            var cs = 42;
            for (var i = 0; i<self.msgBody.length; i++) {
               cs += self.msgBody[i];
            }
            if (cs == csSent) {
               // remove message from input buffer
               self.buf.splice(0, self.bufIndex);
               self.msgBody.shift();
               if (self.ignoreMsgCount > 0) {
                  self.ignoreMsgCount--;
               } else {
                  routeIncomingMessage(self.msgBody);
               }
            } else {
               console.log("Check sum error.");
               self.buf.shift();
            }
            self.commHandler = self.scanForStx;
            self.scanForStx();
         }

         self.commHandler = self.scanForStx;

         self.tty.on('data', function(data) {
            // network byte order is big endian... let's go with that
            self.buf = self.buf.concat((new stream.Reader(data, stream.BIG_ENDIAN)).readBytes(data.length));
            self.commHandler();
         });

         self.tty.on('error', function(err) {
            console.log('serial error:');
            console.log(err);
         });

         self.tty.on('disconnect', function(err) {
            console.log('error disconnecting?');
            console.log(err);
         });

         self.send = function(data) {
            // parse data into the format that usb devices expect and transmit it
            var dataBytes = parsers.parseJsonToStream(data);
            var writer = new stream.Writer(dataBytes.length+1, stream.BIG_ENDIAN);
            writer.writeUInt8(dataBytes.length);
            writer.writeBytes(dataBytes);
            var buf = writer.toArray();
            var outBuf = [];

            if (buf.length > 255) {
               console.log("ERROR: Cannot send a message longer than 255 bytes!!!");
               return;
            }

            var encodeByteToArray = function(b, a) {
               if (b == ESC || b == STX) {
                  a.push(ESC);
               }
               a.push(b);
            }

            // Take message body, wrap in STX and checksum, add escapes as needed.
            outBuf.push(STX);
            encodeByteToArray(buf.length, outBuf);
            var cs = 42;
            for (var i=0; i<buf.length; i++) {
               encodeByteToArray(buf[i], outBuf);
               cs += buf[i];
            }
            encodeByteToArray(commons.getNibble(cs, 2), outBuf);
            encodeByteToArray(commons.getNibble(cs, 1), outBuf);
            self.tty.write(outBuf, function(err) {
               if (err) {
                  console.log('error writing to serial');
                  console.log(err);
               }
            });
            return;

            writer.writeUInt8(dataBytes.length);
            writer.writeBytes(dataBytes);
            console.log("WRITER in send",writer.toArray());
            self.tty.write(writer.toArray(), function(err) {
               if (err) {
                  console.log('error writing to serial');
                  console.log(err);
               }
            });
         };

         console.log("Calling open callback...");
         if (self.onOpenCallback) {
            self.onOpenCallback();
         }
      });
   });

   function cronCallback(id) {
      return function() {
         var msgContent = commons.encodeTime(id);

         self.send({
            type: 0x05,
            content: msgContent
         });
      };
   }

   function registerResource(data) {
      var that = {};

      if (data.name === undefined) {
         console.log("name property not found.");
         return;
      }
      if (data.resID === undefined) {
         console.log("resID property not found.");
         return;
      }
      if(data.initVal === undefined) {
         console.log("initVal property not found.");
         return;
      }
      if(data.canUp === undefined) {
         console.log("canUp propery not found.");
         return;
      }

      // Don't try to register the resource unless we have a cloud connection.
      if (!self.resources.hasOwnProperty("createResource")) {
         console.log("Unable to create resource, cloud is not ready.  Retrying in 1 second.");
         setTimeout(registerResource, 1000, data);
         return;
      }

      console.log("Registering resource " + data.name + " with resource ID " + data.resID);

      if (self.resources.hasOwnProperty(data.resID)) {
         console.log("Property creation already underway.");
         return;
      }

      that.name = data.name;
      that.resourceID = data.resID;
      that.initVal = data.initVal;
      that.canUp = data.canUp;

      that.update = function(newVal) {
         var obj = {};
         obj[that.name] = newVal;
         if (that.value) {
            that.value.update(obj, function(e) {
               if (e) {
                  console.log("Error updating value.");
               } else {
                  console.log("Updated " + that.name + " to " + newVal);
               }
            });
         }
      }

      if (data.canUp === 1) {
         that.onChange = function(snap) {
            console.log("-----> Data changed for " + self.UUID + ", resource " + that.name + ", res ID " + that.resourceID + " to value " + snap.val());
            self.send({
               type: that.resourceID,
               content: {
                  numericType: 'U8',
               numericValue: snap.val()
               }
            });
         }
      } else {
         that.onChange = null;
      }

      self.resources[data.resID] = that;

      self.resources.createResource(that.name, data.initVal, that.onChange, function(e, attachment) {
         if (e) {
            console.log("Error creating resource " + data.name + " on firebase.");
            console.log(e);
         } else {
            console.log("Resource successfully created for " + data.name + " with resource ID " + data.resID);
            self.resources[data.resID].value = attachment;
         }
      });

   }

   function updateResource(content) {
      if(content.resID === undefined) {
         console.log("Error updating resource, resID field missing.");
         return;
      }
      if (content.val === undefined) {
         console.log("Error updating resource, val field missing.");
         return;
      }
      if (self.resources.hasOwnProperty(content.resID)) {
         self.resources[content.resID].update(content.val);
      }
   }

   function routeIncomingMessage(data) {
      // parse into whatever form and then send it along
      var jsonData = parsers.parseStreamToJson(data);

      switch (jsonData.type) {
         case 0x00:
            if (jsonData.content === undefined) {
               console.log("Content is missing from message type 0x00 received from attachment.");
               return;
            }
            self.deviceType = jsonData.content[0];
            self.UUID = jsonData.content[1];
            console.log('REGISTERed device "'+self.deviceType+'" with UUID '+ self.UUID + '!');

            if (attachments.create) {
               attachments.create(self.deviceType, self.UUID, function(e, resources) {
                  if (e) {
                     console.log("Error creating attachment.");
                     console.log(e);
                  } else {
                     console.log("Attachment successfully created.");
                     self.resources = resources;
                     self.registered = true;
                  }
               });
            } 
            break;

         case 0x01: // subscribe to data stream
            console.log(self.deviceType + ' SUBSCRIBEs to ' + jsonData.content + '!');
            self.subscriptions.add(jsonData.content);
            break;
         case 0x02: // unsubscribe to data stream
            console.log(self.deviceType + ' UNSUBSCRIBEs to ' + jsonData.content + '!');
            self.subscriptions.remove(jsonData.content);
            break;
         case 0x03: // set alarm
            var cronId = jsonData.content.charCodeAt(0);
            var cronString = jsonData.content.substring(1);
            console.log(self.deviceType + ' ALARM_SETS ' + cronString + '(' + cronId + ') !');
            self.cronJobs[cronId] = new CronJob(cronString, cronCallback(cronId));
            self.cronJobs[cronId].start();
            break;
         case 0x04: // unset alarm
            console.log(self.deviceType + ' ALARM_UNSETS (' + jsonData.content + ') !');
            if (self.cronJobs[jsonData.content]) {
               self.cronJobs[jsonData.content].stop();
               delete self.cronJobs[jsonData.content];
            }
            break;
         case 0x06: // get time
            self.send({
               type: 0x07,
               content: commons.encodeTime()
            });
            break;
         case 0x09: // register resource on firebase
            // JSON payload will be resource name, initial value, resource id, and updateable
            registerResource(jsonData.content);
            break;
         case 0x0a: // update resource on firebase
            // JSON payload will be resource id and new value
            updateResource(jsonData.content);
            break;
         default:
            try {
               jsonData.device = self.deviceType;
               console.log("TYPE received",jsonData.type, "(0x" + jsonData.type.toString(16) + ")");
               console.log("CONTENT received",jsonData.content);
               if (attachments.chillhub) {
                  console.log("Device type: " + self.deviceType);
                  console.log("UUID: " + self.UUID);
                  chillhub = attachments.chillhub.child(self.deviceType).child(self.UUID);
                  attachments.chillhub.child(self.deviceType).child(self.UUID).update(jsonData.content, function(e) {
                     if (e) {
                        console.log("Error updating value.");
                     } else {
                        console.log("Update complete.");
                     }
                  });
               }
            } catch (e) {
               console.log("Error reading data from serial port possibly due to garbage.");
            }
      }	
   }	

   self.cleanup = function() {
      for (var j in self.cronJobs)
         self.cronJobs[j].stop();
   };

   self.registerOpenCallback = function(func) {
      self.onOpenCallback = func;
   }

   self.sendRegistrationRequest = function sendRegistrationRequest () {
      self.send({
         type: 0x08,
         content: {
            numericType: 'U8',
         numericValue: 1
         }
      });
   }

   self.checkForDeviceRegistration = function checkForDeviceRegistration() {
      if (!self.registered) {
         console.log("Device was not properly registered, requesting registration info again.");
         self.sendRegistrationRequest();
         setTimeout(self.checkForDeviceRegistration, 5000);
      } 
   }

   setTimeout(self.checkForDeviceRegistration, 5000);
}

var devices = {};

exports.init = function(receiverCallback, deviceListCallback, attachmentsRoot) {
   attachments = attachmentsRoot;
   /*
   for (var pn in attachmentsRoot) {
      console.log(pn + ": " + attachmentsRoot[pn]);
   }
   */

   if (process.platform === 'darwin') {
      console.log("We are running on a Mac, look for tty.usbmodem devices.");
	   var filePattern = /^tty.usbmodem[0-9]+$/;
   } else {
	   var filePattern = /^ttyACM[0-9]{1,2}$/;
   }
	
	//similar to announce()
	var listDevices = function() {
		var devList = [];
		for (var dev in devices)
			devList.push(devices[dev].deviceType);
		deviceListCallback(devList);
		//TODO add logic to send list of devices to Firebase
	}
	
	var callbackWrapper = function(dev, msg) {
		msg.devId = dev.uid;
		receiverCallback(msg);
	};
	
	fs.readdir('/dev/', function(err, files) {
		files = files.filter(function(file) {
			return filePattern.test(file);
		});
		
		files.forEach(function(filename) {
			console.log('registering new USB device ' + filename);
			devices[filename] = new ChillhubDevice(filename, callbackWrapper, listDevices);
         (function() {
            var what = filename;
            devices[filename].registerOpenCallback (function() {
               devices[what].sendRegistrationRequest();
            });
         })();
		});
	});
	
	// watch for new devices
	fs.watch('/dev/', function(event, filename) {
		if (!filePattern.test(filename))
			return;
		
		fs.exists('/dev/'+filename, function (exists) {
			if (devices[filename] && !exists) {
				console.log('unregistering USB device ' + filename);
				devices[filename].cleanup();
				delete devices[filename];
				listDevices();
			}
			else if (!devices[filename] && exists) {
				console.log('registering new USB device ' + filename);
				devices[filename] = new ChillhubDevice(filename, callbackWrapper, listDevices);
			}
		});
	});
};

exports.subscriberBroadcast = function(type, data) {
	var SUBSCRIPTION_MESSAGES = {
		filterAlert: { id: 0x10, format: 'U8' },
		waterFilterCalendarTimer: { id: 0x11, format: 'U16' },
		waterFilterCalendarPercentUsed: { id: 0x12, format: 'U8' },
		waterFilterHoursRemaining: { id: 0x13, format: 'U16' },
		waterUsageTimer: { id: 0x14, format: 'U32' },
		waterFilterUsageTimePercentUsed: { id: 0x15, format: 'U8' },
		waterFilterOuncesRemaining: { id: 0x16, format: 'U32' },
		commandFeatures: { id: 0x17, format: 'U8' },
		temperatureAlert: { id: 0x18, format: 'U8' },
		freshFoodTemperatureDisplay: { id: 0x19, format: 'I8' },
		freezerTemperatureDisplay: { id: 0x1A, format: 'I8' },
		freshFoodTemperatureSetpoint: { id: 0x1B, format: 'I8' },
		freezerTemperatureSetpoint: { id: 0x1C, format: 'I8' },
		doorAlarmAlert: { id: 0x1D, format: 'U8' },
		iceMakerBucketStatus: { id: 0x1E, format: 'U8' },
		odorFilterCalendarTimer: { id: 0x1F, format: 'U16' },
		odorFilterPercentUsed: { id: 0x20, format: 'U8' },
		odorFilterHoursRemaining: { id: 0x21, format: 'U8' },
		doorState: { id: 0x22, format: 'U8' },
		dcSwitchState: { id: 0x23, format: 'U8' },
		acInputState: { id: 0x24, format: 'U8' },
		iceMakerMoldThermistorTemperature: { id: 0x25, format: 'I16' },
		iceCabinetThermistorTemperature: { id: 0x26, format: 'I16' },
		hotWaterThermistor1Temperature: { id: 0x27, format: 'U16' },
		hotWaterThermistor2Temperature: { id: 0x28, format: 'U16' },
		dctSwitchState: { id: 0x29, format: 'U8' },
		relayStatus: { id: 0x2A, format: 'U8' },
		ductDoorStatus: { id: 0x2B, format: 'U8' },
		iceMakerStateSelection: { id: 0x2C, format: 'U8' },
		iceMakerOperationalState: { id: 0x2D, format: 'U8' }
	};
	
	var message = {
		type: SUBSCRIPTION_MESSAGES[type].id,
		content: {
			numericType: SUBSCRIPTION_MESSAGES[type].format,
			numericValue: data
		}
	};
	
	for (var j in devices) {
		if (devices[j].subscriptions.has(message.type)) {
			console.log('SENDING ' + message.type + ' to ' + devices[j].deviceType);
			devices[j].send(message);
		}
	}
};
