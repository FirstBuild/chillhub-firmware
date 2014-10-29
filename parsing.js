/*
* Parsing functions
*/

var stream = require('binary-stream');

// exports function to make them available to other files
exports.parseStreamToJson = function(data) {
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

exports.parseJsonToStream = function(message) {
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