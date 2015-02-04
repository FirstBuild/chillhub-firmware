var serial = require('serialport');
var fs = require('fs');
var stream = require('binary-stream');
var sets = require('simplesets');
var commons = require('./commons');
var parsers = require('./parsing');
var uuid = require('uuid-v4');
var CRC = require('crc');

function ChillhubDevice(ttyPath) {
   var self = this;

   var ESC = 0xfe;
   var STX = 0xff;
   self.deviceType = '';
   self.UUID = '';
   self.buf = [];
   self.msgBody = [];
   self.resources = {};
   self.registered = false;
   self.newUUID = '';

   self.uid = ttyPath;
   self.tty = new serial.SerialPort('/dev/'+ttyPath, { 
      baudrate: 115200, 
      disconnectedCallback: function(err) {
         if (err) {
            console.log('error in disconnectedCallback');
            console.log(err);
            console.log('UUID is ' + self.UUID);
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
            var crcSent = self.msgBody.pop() + self.msgBody.pop()*256;
            crc =  CRC.crc16ccitt(self.msgBody);
            if (crc == crcSent) {
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
            return;

            while(self.buf.length > self.buf[0]) {
               msg = self.buf.slice(1,self.buf[0]+1);
               self.buf = self.buf.slice(self.buf[0]+1,self.buf.length);
               if (msg.length > 0) {
                  routeIncomingMessage(msg);
               }
            }
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
            var crc = CRC.crc16ccitt(buf);
            for (var i=0; i<buf.length; i++) {
               encodeByteToArray(buf[i], outBuf);
            }
            encodeByteToArray(commons.getNibble(crc, 2), outBuf);
            encodeByteToArray(commons.getNibble(crc, 1), outBuf);
            self.tty.write(outBuf, function(err) {
               if (err) {
                  console.log('error writing to serial');
                  console.log(err);
               }
            });
            return;
         };

         if (self.onOpenCallback) {
            self.onOpenCallback();
         }
      });
   });

   function setDeviceUUID() {
      self.send({
         type: 0x0c,
         content: self.newUUID
      });
      // wait a little, then request UUID again.
      setTimeout(function() {
         self.send({
            type: 0x08,
            content: {
               numericType: 'U8',
               numericValue: 1
            }
         });
      }, 2000);
   }

   function startSetUUIDProcess() {
      self.newUUID = uuid();
      console.log("Attempting to set UUID to: " + self.newUUID);
      setDeviceUUID();
   }

   function routeIncomingMessage(data) {
      // parse into whatever form and then send it along
      var jsonData = parsers.parseStreamToJson(data);

      switch (jsonData.type) {
         case 0x00:
            if (self.registered == false) {
               if (jsonData.content === undefined) {
                  console.log("Content is missing from message type 0x00 received from attachment.");
                  return;
               }
               self.deviceType = jsonData.content[0];
               self.UUID = jsonData.content[1];
               console.log('Found device "'+self.deviceType+'" with UUID '+ self.UUID + '!');

               self.registered = true;
               startSetUUIDProcess();
            } else {
               // we were registered, see if the set UUID process worked.
               if (jsonData.content === undefined) {
                  console.log("Content is missing from message type 0x00 received from attachment.");
                  return;
               }
               self.deviceType = jsonData.content[0];
               self.UUID = jsonData.content[1];
               if (self.UUID === self.newUUID) {
                  console.log("New UUID successfully set.");
                  process.exit(0);
               } else {
                  console.log("ERROR: Unable to set the UUID on the device.");
                  console.log("The device sent a UUID of " + self.UUID);
                  process.exit(1);
               }
            }
            break;
      }	
   }	

   self.cleanup = function() {
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

if (process.platform === 'darwin') {
   console.log("We are running on a Mac, look for tty.usbmodem devices.");
   var filePattern = /^tty.usbmodem[0-9]+$/;
} else {
   var filePattern = /^ttyACM[0-9]{1,2}$/;
}

fs.readdir('/dev/', function(err, files) {
   files = files.filter(function(file) {
      return filePattern.test(file);
   });

   files.forEach(function(filename) {
      console.log('registering new USB device ' + filename);
      devices[filename] = new ChillhubDevice(filename);
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
   console.log("Saw a change in dev.");
   if (!filePattern.test(filename))
      return;

   fs.exists('/dev/'+filename, function (exists) {
      if (devices[filename] && !exists) {
         console.log('unregistering USB device ' + filename);
         devices[filename].cleanup();
         delete devices[filename];
      }
      else if (!devices[filename] && exists) {
         console.log('registering new USB device ' + filename);
         devices[filename] = new ChillhubDevice(filename);
      }
   });
});

