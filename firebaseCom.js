/*
* Firebase communication
*/
var Firebase = require("firebase");
var _ = require("underscore");
var FBURI = "https://1buildbeerbeta.firebaseio.com/" // root url for Firebase
var fb = new Firebase(FBURI);

exports.updateObjectFieldFirebase = function(objectId,field,value){
	var rootRef = fb.child('objects').child(objectId).child(field);
	rootRef.set(value);

	var objectRef = fb.child('objects').child(objectId)
	objectRef.once('value',function(snap){
		console.log(snap.val())
	});

}

exports.addListener=function(collection,objectId,field,callback){
	var fieldRef = fb.child(collection).child(objectId).child(field)
	fieldRef.on("value",function(snap){
		console.log("listener on"+snap.val());
		//sendMSG to Arduino
		callback(snap.val());
	})
}

// Load schema from Firebase for a deviceType and return values in an array
exports.loadSchema = function(deviceType,callback){
	var schemaRef = fb.child('schemas').child(deviceType)
	schemaRef.once('value',function(snap){
		callback(snap.val())
	})
}