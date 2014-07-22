var http = require('http');
var gea = require("gea-sdk");
var adapter = require("gea-adapter-usb");
var devices = require("./chillhub-devices");

var app = gea.configure({
    address: 0xcb
});

var messageRelay = function() {
	var req = http.request({
		hostname: 'www.the_chillhub_cloud_server_for_the_web.com',
		path: '/some_path_or_something_goes_here_for_sure',
		method: 'POST'
	});
	
	req.write(json + '\n');
	req.end();
};

var messageBroadcast = function(subType) {
	return function(data) {
		devices.subscriberBroadcast(subType, data);
	};
};

devices.init(messageRelay);

app.bind(adapter, function (bus) {
    bus.on("refrigerator", function (refrigerator) {
		console.log('connected to fridge!');
		refrigerator.filterAlert.subscribe(messageBroadcast('filterAlert'));
		refrigerator.filterExpirationStatus.subscribe(messageBroadcast('filterExpirationStatus'));
		refrigerator.commandFeatures.subscribe(messageBroadcast('commandFeatures'));
		refrigerator.temperatureAlert.subscribe(messageBroadcast('temperatureAlert'));
		refrigerator.displayTemperature.subscribe(messageBroadcast('displayTemperature'));
		refrigerator.setpointTemperature.subscribe(messageBroadcast('setpointTemperature'));
		refrigerator.doorAlarmAlert.subscribe(messageBroadcast('doorAlarmAlert'));
		refrigerator.iceMakerBucketStatus.subscribe(messageBroadcast('iceMakerBucketStatus'));
		refrigerator.odorFilterExpirationStatus.subscribe(messageBroadcast('odorFilterExpirationStatus'));
		refrigerator.doorState.subscribe(messageBroadcast('doorState'));
		refrigerator.doorBoard.information.subscribe(messageBroadcast('doorBoardInfo'));
		console.log('subscribed to all fridge events');
    });
});