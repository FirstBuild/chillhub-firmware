// Packages...
var fs = require('fs');
var gea = require('green-bean');
var devices = require('./chillhub-devices');
var firebase = require("firebase");
var util = require("util");
var fb = require('./firebaseHelper.js');
// Configs
var packageFile = "./package.json";
var configFile = "./share/chillhub.json";
var hwVersion = '1.0.0';

var messageRelay = function(data) {
   console.log("<---- In messageRelay ---->");
	console.log(data);
};

var deviceAnnounce = function(devlist) {
   console.log("<---- In deviceAnnounce ---->");
	console.log(devlist);
}

var messageBroadcast = function(data) {
   console.log("<---- In messageBroadcast ---->");
};

var startFirebase = function(swVersion) {
   console.log("Sending this SW version to firebase: " + swVersion);
   fb.startConnection(configFile, hwVersion, swVersion, function(e, attachments) {
      if (e) {
         console.log("Error connecting to firebase.");
      } else {
         // got our attachment point
         console.log("Connected to firebase, initializing devices.");
         devices.init(messageRelay, deviceAnnounce, attachments);
      }
   });
}

fs.readFile(packageFile, function(e, data) {
   var ver = "UNKNOWN";
   if (e) {
      console.log("Error opening " + packageFile + ".");
      printError(e);
   } else {
      console.log("Package file opened.");
      var obj = JSON.parse(data);
      if (obj.version) {
         ver = obj.version;
         console.log("Found software version: " + ver);
      } else {
         console.log("Unable to find the chillhub firmware version in " + packageFile + ".");
      }
   }
   startFirebase(ver);
});

/*
gea.connect('refrigerator', function(refrigerator) {
	console.log('connected to fridge!');
	
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
*/
