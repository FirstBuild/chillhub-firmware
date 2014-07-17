var http = require('http');
var gea = require("gea-sdk");
var adapter = require("gea-adapter-usb");
var devices = require("chillhub-devices");

var app = gea.configure({
    address: 0xcb
});

var messageRelay = function() {
	http.post(/* something here */);
};

var messageBroadcast = function(x) {
	devices.broadcast(x);
};

devices.init(messageRelay);

app.bind(adapter, function (bus) {
    bus.on("refrigerator", function (refrigerator) {		
		refrigerator.filterAlert.subscribe(messageBroadcast);
		refrigerator.filterExpirationStatus.subscribe(messageBroadcast);
		refrigerator.commandFeatures.subscribe(messageBroadcast);
		refrigerator.temperatureAlert.subscribe(messageBroadcast);
		refrigerator.displayTemperature.subscribe(messageBroadcast);
		refrigerator.setpointTemperature.subscribe(messageBroadcast);
		refrigerator.doorAlarmAlert.subscribe(messageBroadcast);
		refrigerator.iceMakerBucketStatus.subscribe(messageBroadcast);
		refrigerator.odorFilterExpirationStatus.subscribe(messageBroadcast);
		refrigerator.doorState.subscribe(messageBroadcast);
		refrigerator.doorBoard.information.subscribe(messageBroadcast);
    });
});