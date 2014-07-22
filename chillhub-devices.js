var util = require("util");
var events = require("events");
var hid = require("node-hid");
var stream = require("binary-stream");
var sets = require('simplesets');

function ChillhubDevice(hidPath, receive) {
	var deviceType = '';
	var subscriptions = new sets.Set();
	var hid = new hid.HID(hidPath);
	
	function hasPath(p) {
		return (hidPath == p);
	}
	
	hid.on("data", function(data) {
		// parse into whatever form and then send it along
		var jsonData = parseStreamToJson(data);
		switch (jsonData.type) {
			case 0x00:
				this.deviceType = data.content;
				break;
			case 0x01: // subscribe to data stream
				this.subscriptions.add(jsonData.content);
				break;
			case 0x02: // unsubscribe to data stream
				this.subscriptions.remove(jsonData.content);
				break;
			default:
				jsonData.device = this.deviceType;
				receive(this, jsonData);
		}
	});
	
	function parseStreamToJson(data) {
		var getDataReadFunction = function(instream) {
			var readFcn;
			switch(instream.readUInt8()) {
				case 0x02: // string
					readFcn = parseStringFromStream(instream);
				case 0x03: // numeric types
					readFcn = function(stream) {
						return stream.readUInt8();
					};
				case 0x04:
					readFcn = function(stream) {
						return stream.readInt8();
					};
				case 0x05:
					readFcn = function(stream) {
						return stream.readUInt16();
					};
				case 0x06:
					readFcn = function(stream) {
						return stream.readInt16();
					};
				case 0x07:
					readFcn = function(stream) {
						return stream.readUInt32();
					};
				case 0x08:
					readFcn = function(stream) {
						return stream.readInt32();
					};
				case 0x09: // js object
					readFcn = parseObjectFromStream(instream);
				case 0x10: // boolean (could also be done as a uint8)
					readFcn = parseBooleanFromStream(instream);
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
			return instream.read(length);
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
		
		var reader = stream.Reader(data);
		return {
			type: reader.readUInt16(),
			content: parseDataFromStream(reader)
		};
	}
	
	function send(data) {
		// parse data into the format that chillpills expect and transmit via
		device.write(parseJsonToStream(data));
	}
	
	function parseJsonToStream(message) {
		var parseArrayToString = function(outstream, array, doWriteType) {
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
			outstream.write(str);
		};
		
		var parseNumericToStream = function(outstream, num, doWriteType) {
			var types = (num < 0) ? [
				{max: 127, min: -128, fcn: outstream.writeInt8, id: 0x04},
				{max: 32767, min: -32768, fcn: outstream.writeInt16, id: 0x06},
				{max: Infinity, min: -Infinity, fcn: outstream.writeInt32, id: 0x08}
			] : [ 
				{max: 255, min: 0, fcn: outstream.writeUInt8, id: 0x03}, 
				{max: 65535, min: 0, fcn: outstream.writeUInt16, id: 0x03}, 
				{max: Infinity, min: 0, fcn: outstream.writeUInt32, id: 0x03}
			];
			
			var i = 0;
			while (true) {
				if ((num <= types[i].max) && (num >= types[i].min)) {
					if (doWriteType)
						outstream.writeUInt8(types[i].id);
					types[i].fcn(num);
					return types[i].fcn;
				}
				i++;
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
		
		var parseDataToStream = function(outstream, data, doWriteType) {
			var parseFcn;
			switch ( Object.prototype.toString.call(data) ) {
				case "[object String]":
					parseFcn = parseStringToStream;
					break;
				case "[object Boolean]":
					parseFcn = parseBooleanToStream;
					break;
				case "[object Number]":
					parseFcn = parseNumericToStream;
					break;
				case "[object Array]":
					parseFcn = parseArrayToStream;
					break
				default:
					parseFcn = parseObjectToStream;
					break;
			}
			parseFcn(outstream, data, doWriteType);
		};
		
		var writer = new stream.Writer(data.length + 5);
		writer.writeUInt16(message.type);
		parseDataToStream(writer, message.content, true);
	}
}

exports.init = function(receiverCallback) {
	var devSet = [];
	var thenSet = new sets.Set();
	
	var callbackWrapper = function(dev, msg) {
		msg.devId = devSet.indexOf(obj);
		receiverCallback(msg);
	};
	
	// watch for new devices
	setTimeout(function() {
		var devices = hid.devices();		
		var nowSet = new sets.Set(devices);
		
		// if some device is in devices but previously wasn't, register it
		nowSet.difference(thenSet).array().filter(function(ele) {
			// this one is the GEA adapter... should filter out others (camera?)
			return !((ele.vendorId == 1240) && (ele.productId == 64752));
		}).forEach(function(ele) {
			console.log('registering new USB device ' + ele);
			devSet.push(new ChillhubDevice(ele.path, callbackWrapper));
		});
		
		// if some device was in devices but now isn't, destroy it
		thenSet.difference(nowSet).array().forEach(function(ele) {
			console.log('unregistering USB device ' + ele);
			
			// almost certainly a better way of doing this, but couldn't say what it is...
			var deleteSet = devSet.filter(function(dev) {
				return dev.hasPath(ele.path);
			});
			devSet = devSet.filter(function(dev) {
				return !dev.hasPath(ele.path);
			});
			
			for (var j = 0; j < deleteSet.length; j++) {
				delete deleteSet[j];
			}
		});
		
		thenSet = nowSet;
	}, 5000);
	
	var SUBSCRIPTION_MESSAGE_IDS = {
		filterAlert: 0x10,
		filterExpirationStatus: 0x11,
		commandFeatures: 0x12,
		temperatureAlert: 0x13,
		displayTemperature: 0x14,
		setpointTemperature: 0x15,
		doorAlarmAlert: 0x16,
		iceMakerBucketStatus: 0x17,
		odorFilterExpirationStatus: 0x18,
		doorState: 0x19,
		doorBoardInfo: 0x1A,
	};
	
	function subscriberBroadcast(type, data) {
		var message = {
			type: SUBSCRIPTION_MESSAGE_IDS[type],
			content: data
		};
		
		chillPills.forEach(function(ele) {
			if (ele.subscriptions.has(data.type))
				ele.send(data);
		});
	}
};