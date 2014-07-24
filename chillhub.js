var http = require('http');
var gea = require('gea-sdk');
var adapter = require('gea-adapter-usb');
var devices = require('./chillhub-devices');

var app = gea.configure({
    address: 0xCB,
	version: [0,0,1,0]
});
app.plugin(require('gea-plugin-refrigerator'));

var messageRelay = function(data) {
	/*var req = http.request({
		hostname: 'www.the_chillhub_cloud_server_for_the_web.com',
		path: '/some_path_or_something_goes_here_for_sure',
		method: 'POST'
	});
	
	req.write(json + '\n');
	req.end();*/
	console.log('POSTing data: ' + data);
};

var messageBroadcast = function(data) {
	for (var field in data)
		devices.subscriberBroadcast(field, data[field]);
};

devices.init(messageRelay);

app.bind(adapter, function (bus) {
	console.log('bound to USB adapter');
    bus.on('refrigerator', function (refrigerator) {
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
});