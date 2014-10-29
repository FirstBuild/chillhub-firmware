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

// Load schema from Firebase for a deviceType and return values in an array
exports.loadSchema = function(deviceType,callback){
	
	var schemaRef = fb.child('schemas').child(deviceType)

	var schema = []
	schemaRef.once('value',function(snap){
		_.each(snap.val().split(','),function(i,v){
			schema.push(i)
		})
		callback(this)
	},schema) //return as an array in callback
}