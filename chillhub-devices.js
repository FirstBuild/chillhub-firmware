var serial = require('serialport');
var fs = require('fs');
var stream = require('binary-stream');
var sets = require('simplesets');
var Firebase = require("firebase");

var CronJob = require('cron').CronJob;

function ChillhubDevice(ttyPath, receive, announce) {
	var self = this;
	
	this.deviceType = '';
	this.subscriptions = new sets.Set([]);
	this.buf = [];
	this.cronJobs = {};
	
	this.uid = ttyPath;
	this.tty = new serial.SerialPort('/dev/'+ttyPath, { 
		baudrate: 115200, 
		disconnectedCallback: function(err) {
			if (err) {
				console.log('error in disconnectedCallback');
				console.log(err);
			}
		}
	});
	
	this.cloudEndpoint = new Firebase("something here");
	cloudEndpoint.on( "value", function(data) {
		for (var field in data) {
			self.send(data[field]);
		}
	});
	
	this.tty.open(function(err) {
		if (err) {
			console.log('error opening serial port');
			console.log(err);
			return;
		}
		
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
		self.tty.on('disconnect', function(err) {
			console.log('error disconnecting?');
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
			
			self.send({
				type: 0x05,
				content: msgContent
			});
		};
	}
	
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
	}
	
	function routeIncomingMessage(data) {
		// parse into whatever form and then send it along
		var jsonData = parseStreamToJson(data);
		
		switch (jsonData.type) {
			case 0x00:
				self.deviceType = jsonData.content;
				console.log('REGISTERed device "'+self.deviceType+'"!');
				announce();
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
					content: encodeTime()
				});
				break;
			default:
				jsonData.device = self.deviceType;
				cloudEndpoint.set(jsonData);
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
					};
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
				case 0x0A: // boolean (could also be done as a uint8)
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
			
			for (var j = 0 ; j < array.length; j++) {
				parseDataToStream(outstream, array[j], (j == 0));
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
			};
		};
		
		var parseObjectToStream = function(outstream, obj, doWriteType) {
			if (doWriteType)
				outstream.writeUInt8(0x09);
			outstream.writeUInt8(Object.keys(obj).length);
			for (var field in obj) {
				outstream.parseStringToStream(outstream, field, false);
				outstream.parseDataToStream(outstream, obj[field], true);
			}
		};
		
		var parseBooleanToStream = function(outstream, bool, doWriteType) {
			if (doWriteType)
				outstream.writeUInt8(0x0A);
			outstream.writeUInt8(bool?0x01:0x00);
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
					if (data.numericType)
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

	self.cleanup = function() {
		for (var j in self.cronJobs)
			self.cronJobs[j].stop();
	};
}

var devices = {};

exports.init = function(receiverCallback, deviceListCallback) {
	var filePattern = /^ttyACM[0-9]{1,2}$/;
	
	var listDevices = function() {
		var devList = [];
		for (var dev in devices)
			devList.push(devices[dev].deviceType);
		deviceListCallback(devList);
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
