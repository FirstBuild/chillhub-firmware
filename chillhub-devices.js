var util = require('util');
var events = require('events');
var serial = require('serialport');
var stream = require('binary-stream');
var sets = require('simplesets');

var CronJob = require('cron').CronJob;
var monitor = require('usb-detection');

function ChillhubDevice(ttyPath, receive) {
	this.deviceType = '';
	this.subscriptions = new sets.Set([]);
	this.tty = new serial.SerialPort(ttyPath, { baudrate: 115200 });
	this.buf = [];
	this.cronJobs = {};
	
	var self = this;
	
	this.hasPath = function(p) {
		return (ttyPath == p);
	};
	
   console.log("Trying to open serial port...");
	this.tty.open(function(err) {
		if (err) {
			console.log('error opening serial port');
			console.log(err);
			return;
		}

      console.log("Serial port open.");
		
      self.tty.on('data', function(data) {
         // network byte order is big endian... let's go with that
         self.buf = self.buf.concat((new stream.Reader(data, stream.BIG_ENDIAN)).readBytes(data.length));
         while(self.buf.length > self.buf[0]) {
            msg = self.buf.slice(1,self.buf[0]+1);
            self.buf = self.buf.slice(self.buf[0]+1,self.buf.length);
            if (msg.length > 0)
         routeIncomingMessage(msg);
         }
      });
      self.tty.on('error', function(err) {
         console.log('serial error:');
         console.log(err);
      });
	
		self.send = function(data) {
			// parse data into the format that usb devices expect and transmit it
			var dataBytes = parseJsonToStream(data);
			var writer = new stream.Writer(dataBytes.length+1, stream.BIG_ENDIAN);
			
			writer.writeUInt8(dataBytes.length);
			writer.writeBytes(dataBytes);
			self.tty.write(writer.toArray(), function(err) {
				if (err) {
					console.log('error writing to serial');
					console.log(err);
				}
			});
		};
	});
	
	function cronCallback(id) {
		return function() {
			var msgContent =  encodeTime(id);

         console.log("In cronCallback");
			
			self.send({
				type: 0x05,
				content: msgContent
			});
		}
	};
	
	function encodeTime(id) {
		var now = new Date();
		var dateField = [now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()];
		if (id) 
			dateField.splice(0, 0, id);
		
		return dateField.map(function(val) {
			return {
				numericType: 'U8',
				numericValue: val
			};
		});
	};
	
	function routeIncomingMessage(data) {
		// parse into whatever form and then send it along
		var jsonData = parseStreamToJson(data);

      console.log("In routeIncomingMessage.");
		
		switch (jsonData.type) {
			case 0x00:
				self.deviceType = jsonData.content;
				console.log('REGISTERed device "'+self.deviceType+'"!');
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
					self.cronJobs[jsonData.content] = null;
				}
				break;
			case 0x06: // get time
				self.send({
					type: 0x07,
					content: self.encodeTime()
				});
				break;
			default:
				jsonData.device = self.deviceType;
				receive(self, jsonData);
		}	
	}
	
	function parseStreamToJson(data) {
		var getDataReadFunction = function(instream) {
			var readFcn;
			switch(instream.readUInt8()) {
				case 0x00: // no data
					readFcn = function(stream) {
						return;
					}
					break;
				case 0x01: // array
					readFcn = parseArrayFromStream;
					break;
				case 0x02: // string
					readFcn = parseStringFromStream;
					break;
				case 0x03: // numeric types
					readFcn = function(stream) {
						return stream.readUInt8();
					};
					break;
				case 0x04:
					readFcn = function(stream) {
						return stream.readInt8();
					};
					break;
				case 0x05:
					readFcn = function(stream) {
						return stream.readUInt16();
					};
					break;
				case 0x06:
					readFcn = function(stream) {
						return stream.readInt16();
					};
					break;
				case 0x07:
					readFcn = function(stream) {
						return stream.readUInt32();
					};
					break;
				case 0x08:
					readFcn = function(stream) {
						return stream.readInt32();
					};
					break;
				case 0x09: // js object
					readFcn = parseObjectFromStream;
					break;
				case 0x10: // boolean (could also be done as a uint8)
					readFcn = parseBooleanFromStream;
					break;
			}
			return readFcn;
		};
		
		var parseArrayFromStream = function(instream) {
			var length = instream.readUInt8();
			var readFcn = getDataReadFunction(instream);
			
			var array = [];
			for (var j = 0; j < length; j++) {
				array.push(readFcn(instream));
			}
			return array;
		};
	
		var parseStringFromStream = function(instream) {
			var length = instream.readUInt8();
			return instream.readAscii(length);
		};
		
		var parseObjectFromStream = function(instream) {
			var length = instream.readUInt8();
			var obj;
			
			for (var i = 0; i < length; i++) {
				var fieldName = parseStringFromStream(instream);
				obj[fieldName] = parseDataFromStream(instream);
			}
			
			return obj;
		};
		
		var parseBooleanFromStream = function(instream) {
			return (instream.readUInt8() != 0);
		};
			
		var parseDataFromStream = function(instream) {
			var readFcn = getDataReadFunction(instream);
			return readFcn(instream);
		};
		
		var reader = new stream.Reader(data, stream.BIG_ENDIAN);
		return {
			type: reader.readUInt8(),
			content: parseDataFromStream(reader)
		};
	}	
	
	function parseJsonToStream(message) {
		var parseArrayToStream = function(outstream, array, doWriteType) {
			if (doWriteType)
				outstream.writeUInt8(0x01);
			outstream.writeUInt8(array.length);
			
			var writeFcn;
			for (var j = 0 ; j < array.length; j++) {
				writeFcn = (j == 0) ? parseDataToStream(outstream, array[j], true) : writeFcn;
				if (writeFcn)
					writeFcn(array[j]);
				else
					parseDataToStream(outstream, array[j], false);
			}
		};
		
		var parseStringToStream = function(outstream, str, doWriteType) {
			if (doWriteType)
				outstream.writeUInt8(0x02);
			outstream.writeUInt8(str.length);
			outstream.writeAscii(str);
		};
		
		var parseNumericToStream = function(outstream, num, doWriteType) {
			// default to I16
			if (doWriteType)
				outstream.writeUInt8(types[i].id);
			outstream.writeInt16(num);
		};
		
		var parseNumericObjectToStream = function(obj) {
			var NUMERIC_TYPES = {
				U8: { fcn: 'writeUInt8', id: 0x03 },
				U16: { fcn: 'writeUInt16', id: 0x05 },
				U32: { fcn: 'writeUInt32', id: 0x07 },
				I8: { fcn: 'writeInt8', id: 0x04 },
				I16: { fcn: 'writeInt16', id: 0x06 },
				I32: { fcn: 'writeInt32', id: 0x08 }
			};
			var objType = NUMERIC_TYPES[obj.numericType];
			
			return function(outstream, num, doWriteType) {
				if (doWriteType) 
					outstream.writeUInt8(objType.id);
				outstream[objType.fcn](num.numericValue);
			}
		};
		
		var parseObjectToStream = function(outstream, obj, doWriteType) {
			if (doWriteType)
				outstream.writeUInt8(0x11);
			outstream.writeUInt8(Object.keys(obj).length);
			for (var field in obj) {
				outstream.parseStringToStream(outstream, field, false);
				outstream.parseDataToStream(outstream, obj[field], true);
			}
		};
		
		var parseBooleanToStream = function(outstream, bool, doWriteType) {
			if (doWriteType)
				outstream.writeUInt8(0x12);
			outstream.writeUInt8(message.content?0x01:0x00);
		};
		
		var parseNothingToStream = function(outstream, data, doWriteType) {
			if (doWriteType)
				outstream.writeUInt8(0x00);
		};
		
		var parseDataToStream = function(outstream, data, doWriteType) {
			var parseFcn;
			switch ( Object.prototype.toString.call(data) ) {
				case '[object String]':
					parseFcn = parseStringToStream;
					break;
				case '[object Boolean]':
					parseFcn = parseBooleanToStream;
					break;
				case '[object Number]':
					parseFcn = parseNumericToStream;
					break;
				case '[object Array]':
					parseFcn = parseArrayToStream;
					break;
				case '[object Null]':
				case '[object Undefined]':
					parseFcn = parseNothingToStream;
					break;
				default:
					if (data['numericType'])
						parseFcn = parseNumericObjectToStream(data);
					else
						parseFcn = parseObjectToStream;
					break;
			}
			parseFcn(outstream, data, doWriteType);
		};
		
		var writer = new stream.Writer(255, stream.BIG_ENDIAN);
		writer.writeUInt8(message.type);
		parseDataToStream(writer, message.content, true);
		return writer.toArray();
	}

	function cleanup() {
		self.cronJobs.map(function(j) {
			j.stop();
		});
	}
}

var devSet = [];

exports.init = function(receiverCallback, deviceListCallback) {
	var thenSet = new sets.Set([]);
	
	var callbackWrapper = function(dev, msg) {
		msg.devId = devSet.indexOf(dev);
		receiverCallback(msg);
	};
		
	// watch for new devices
	//monitor.on('change', function() {
	setInterval(function() {
		var devices = serial.list(function(err, ports) {
			if (err) {
				console.log('error listing serial ports...');
				console.log(err);
				return;
			}
			
			var nowSet = new sets.Set(ports.map(function(port) {
				return port.comName;
			}));
			
			// if some device is in devices but previously wasn't, register it
			nowSet.difference(thenSet).array().forEach(function(ele) {
				console.log('registering new USB device ' + ele);
				devSet.push(new ChillhubDevice(ele, callbackWrapper));
			});
			
			// if some device was in devices but now isn't, destroy it
			var anyDeviceRemoved = false;
			thenSet.difference(nowSet).array().forEach(function(ele) {
				console.log('unregistering USB device ' + ele);
				anyDeviceRemoved = true;
				// almost certainly a better way of doing this, but couldn't say what it is...
				var deleteSet = devSet.filter(function(dev) {
					return dev.hasPath(ele);
				});
				devSet = devSet.filter(function(dev) {
					return !dev.hasPath(ele);
				});
				
				deleteSet.map(function(e) {
               try{
					   e.cleanup();
               }
               catch(err){
                  console.log("Error calling cleanup function.");
               }
				});
				delete deleteSet;
			});
			
			thenSet = nowSet;
			deviceListCallback(devSet.map(function(dev) {
				return dev.deviceType;
			}));
		});
	}, 500);
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
		freshFoodTemperatureDisplay: { id: 0x19, format: 'U8' },
		freezerTemperatureDisplay: { id: 0x1A, format: 'U8' },
		freshFoodTemperatureSetpoint: { id: 0x1B, format: 'U8' },
		freezerTemperatureSetpoint: { id: 0x1C, format: 'U8' },
		doorAlarmAlert: { id: 0x1D, format: 'U8' },
		iceMakerBucketStatus: { id: 0x1E, format: 'U8' },
		odorFilterCalendarTimer: { id: 0x1F, format: 'U16' },
		odorFilterPercentUsed: { id: 0x20, format: 'U8' },
		odorFilterHoursRemaining: { id: 0x21, format: 'U8' },
		doorState: { id: 0x22, format: 'U8' },
		dcSwitchState: { id: 0x23, format: 'U8' },
		acInputState: { id: 0x24, format: 'U8' },
		iceMakerMoldThermistorTemperature: { id: 0x25, format: 'U16' },
		iceCabinetThermistorTemperature: { id: 0x26, format: 'U16' },
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
	
	devSet.forEach(function(ele) {
		if (ele.subscriptions.has(message.type)) {
			ele.send(message);
		}
	});
};
