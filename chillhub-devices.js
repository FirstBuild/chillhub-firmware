var util = require("util");
var events = require("events");
var hid = require("node-hid");
var stream = require("binary-stream");

function ChillPill(hid, receive) {
	var self = this;
	
	hid.on("data", function(data) {
		// parse into whatever form and then send it along
		receive(parse(data));
	});
	
	function send(data) {
		// parse data into the format that chillpills expect and transmit via
		device.write(parse(data));
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