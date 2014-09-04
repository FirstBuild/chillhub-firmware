var http = require('http');
var gea = require('green-bean');
var devices = require('./chillhub-devices');
var request = require('request');
//var Autoclick = require('./autoclick');

//var firebaseUrl = "https://blazing-torch-8537.firebaseio.com/homes/home1/devices"
var firebaseUrl = "https://amber-inferno-1450.firebaseio.com"

//var Firebase = require("firebase");
var util = require("util");

var messageRelay = function(data) {
	var myFirebaseRef = new Firebase(firebaseUrl + 
		data.devId + "/status");
	
	myFirebaseRef.set(data);
};

var deviceAnnounce = function(devlist) {
	var myFirebaseRef = new Firebase(firebaseUrl);
	
	myFirebaseRef.set(devlist);
};

var messageBroadcast = function(data) {
	for (var field in data)
		devices.subscriberBroadcast(field, data[field]);
};

devices.init(messageRelay, deviceAnnounce);

gea.connect('refrigerator', function(refrigerator) {
	console.log('connected to fridge!');
	//autoclick = new Autoclick();
	
	refrigerator.filterAlert.subscribe(messageBroadcast);
	refrigerator.filterExpirationStatus.subscribe(messageBroadcast);
	refrigerator.commandFeatures.subscribe(messageBroadcast);
	refrigerator.temperatureAlert.subscribe(messageBroadcast);
	refrigerator.displayTemperature.subscribe(function(data) {
		for (var field in data)
			devices.subscriberBroadcast(field+'Display', data[field]);
	});
	refrigerator.setpointTemperature.subscribe(function(data) {
		for (var field in data)
			devices.subscriberBroadcast(field+'Setpoint', data[field]);
	});
	refrigerator.doorAlarmAlert.subscribe(messageBroadcast);
	refrigerator.iceMakerBucketStatus.subscribe(messageBroadcast);
	refrigerator.odorFilterExpirationStatus.subscribe(messageBroadcast);
	refrigerator.doorState.subscribe(function(data) {
		messageBroadcast(data);
		
		/*if (data & 0x30) {
			// both doors are open... start webcam work...
			autoclick.start(function(filename) {
				function base64Image(src) {
				   var data = fs.readFileSync(src).toString("base64");
				   return util.format("data:%s;base64,%s", mime.lookup(src), data);
				}
				
				var myFirebaseRef = new Firebase("https://blazing-torch-8537.firebaseio.com/homes/home1/cameras/0/picture");
				var dataUri = base64Image(filename);
				myFirebaseRef.set({picture:dataUri});
			});
		}
		else {
			autoclick.stop();
		}*/
	});
	refrigerator.doorBoard.information.subscribe(messageBroadcast);
	
	console.log('subscribed to all fridge events');
});
