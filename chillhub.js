var gea = require('green-bean');
var devices = require('./chillhub-devices');
//var ac = require('./autoclick-opencv');

var Firebase = require("firebase");
var util = require("util");

var messageRelay = function(data) {
	console.log(data);
	var myFirebaseRef = new Firebase("https://intense-heat-7203.firebaseio.com/homes/home1/devices" + 
		data.devId + "/status");
	
	myFirebaseRef.set(data);
};

var deviceAnnounce = function(devlist) {
	console.log(devlist);
	var myFirebaseRef = new Firebase("https://intense-heat-7203.firebaseio.com/homes/home1/devices");
	
	myFirebaseRef.set(devlist);
};

var messageBroadcast = function(data) {
	for (var field in data)
		devices.subscriberBroadcast(field, data[field]);
};

devices.init(messageRelay, deviceAnnounce);

gea.connect('refrigerator', function(refrigerator) {
	console.log('connected to fridge!');
	//autoclick = new ac.Autoclick();
	
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
	refrigerator.doorState.subscribe(messageBroadcast);
	refrigerator.doorBoard.information.subscribe(messageBroadcast);
	
	console.log('subscribed to all fridge events');
});
