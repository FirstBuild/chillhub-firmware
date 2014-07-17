var util = require("util");
var events = require("events");
var hid = require("node-hid");
var stream = require("binary-stream");

function ChillPill(hid, receive) {
	var self = this;
	
	hid.on("data", function(data) {
		// parse into whatever form and then send it along
		receive(parseStreamToJson(data));
	});
	
	function parseStreamToJson(data) {
		var parseStringFromStream = function(instream) {
			var length = instream.readUInt8();
			return instream.read(length);
		};
		
		var parseBooleanFromStream = function(instream) {
			return (instream.readUInt8() != 0);
		}
		
		var parseBytesFromStream = function(instream) {
			var length = instream.readUInt8();
			return instream.readBytes(length);
		}
		
		var parseObjectFromStream = function(instream) {
			var length = instream.readUInt8();
			var obj;
			
			for (var i = 0; i < length; i++) {
				var fieldName = parseStringFromStream(instream);
				obj[fieldName] = parseDataFromStream(instream);
			}
			
			return obj;
		}
			
		var parseDataFromStream = function(instream) {
			switch (instream.readUInt8()) {
				case 0x01: // array
					break;
				case 0x02: // string
					return parseStringFromStream(instream);
				case 0x03: // numeric types
					return instream.readUInt8();
				case 0x04:
					return instream.readInt8();
				case 0x05:
					return instream.readUInt16();
				case 0x06:
					return instream.readInt16();
				case 0x07:
					return instream.readUInt32();
				case 0x08:
					return instream.readInt32();
				case 0x09:
					return instream.readFloat32();
				case 0x10:
					return instream.readFloat64();
				case 0x11: // js object
					return parseObjectFromStream(instream);
				case 0x12: // byte array
					return parseBytesFromStream(instream);
				case 0x13: // boolean (could also be done as a uint8)
					return parseBooleanFromStream(instream);
			}
		};
		
		var reader = stream.Reader(data);
		return {
			type: reader.readUInt16();
			content: parseDataFromStream(reader);
		};
	}
	
	function send(data) {
		// parse data into the format that chillpills expect and transmit via
		device.write(parseJsonToStream(data));
	}
	
	function parseJsonToStream(message) {
		var parseStringToStream = function(outstream, str) {
			outstream.writeUInt8(0x02);
			outstream.writeUInt8(str.length);
			outstream.write(str);
		};
		
		var parseBooleanToStream = function(outstream, bool) {
			outstream.writeUInt8(0x03);
			outstream.writeUInt8(message.content?0x01:0x00);
		};
		
		var parseObjectToStream = function(outstream, obj) {
			outstream.writeUInt8(0x11);
			oustream.writeUInt8(Object.keys(obj).length);
			for (var field in obj) {
				outstream.parseStringToStream(outstream, field);
				outstream.parseDataToStream(outstream, obj[field]);
			}
		};
		
		var parseDataToStream = function(outstream, data) {
			switch (typeof(data)) {
				case "string":
					parseStringToStream(outstream, data);
					break;
				case "boolean":
					parseBooleanToStream(outstream, data);
					break;
				case "number":
					// ?
					break;
				case "object":
					parseObjectToStream(outstream, data);
					break;
			}
		};
		
		var writer = new stream.Writer(data.length + 5);
		writer.writeUInt16(message.type);
		parseDataToStream(message.content);
	}
}

exports.init = function(callback) {
	var chillPills;
	var lastDevices;
	
	// watch for new devices
	setTimeout(function() {
		var devices = hid.devices(?, ?);
		
		// if some device is in devices but not in lastDevices, register it
		chillPills.push(new ChillPill(new hid.HID(devices[x].path), callback));
		
		// if some device is in lastDevices but not in devices, destroy it
		
		lastDevices = devices;
	}, 5000);
	
	function broadcast(data) {
		chillPills.forAll(function() {
			this.send(data);
		});
	}
};