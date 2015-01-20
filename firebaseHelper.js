var ch = require('./lib/chillhub.js');
var fb = require('firebase');
var fs = require('fs');

var token = "";
var chUUID = "";
var hardware_version = "1.0.0";
var software_version = '1.0.0';
var attachments = [];
var hostCallback = {};

var printError = function(e) {
   for(var propName in e) {
      console.log(propName + ": " + e[propName]);
   }
}

function UndefinedPropertyError(property) {
  this.kind = 'error#undefined-property';
  this.property = property;
}

function ConfigFileNotFoundError(error) {
  this.kind = 'error#config-file-not-found';
  this.method = 'readFile';
  this.error = error;
}

var startConnection = function(configFile, hwVersion, swVersion, callback) {
   if(callback) {
      if (configFile) {
         if(hwVersion) {
            if(swVersion) {
               hardware_version = hwVersion;
               software_version = swVersion;
               hostCallback = callback;
               fs.readFile(configFile, function(e, data) {
                  if (e) {
                     console.log("Error opening config file.");
                     printError(e);
                     hostCallback(new ConfigFileNotFoundError(e));
                  } else {
                     console.log("Config file opened.");
                     var obj = JSON.parse(data);
                     token = obj.token;
                     chUUID = obj.uuid;
                     connectToFirebase(fb, token, chUUID);
                  }
               });
            } else { // if swVersion
               callback(new UndefinedPropertyError('swVersion'));
            }
         } else { // if hwVersion
            callback(new UndefinedPropertyError('hwVersion'));
         }
      } else { // if configFile
         callback(new UndefinedPropertyError('configFile'));
      }
   } else { // if callback
      throw new UndefinedPropertyError('callback');
   }
}

var connectToFirebase = function(fb, token, chUUID) {
   ch(fb, Date).login(token, function(e, hub) {
      if (e) {
         console.log("Error logging into firebase.");
         printError(e);
         // pass the error back to the host
         hostCallback(e);
      } else {
         console.log("Successful firebase login.");
         createChillhub(hub);
      }
   } );
}

var createChillhub = function(hub) {
   hub.create(chUUID, hardware_version, software_version, function(e, attachment) {
      if (e) {
         console.log("Error creating chillhub device.");
         printError(e);
         // pass the error back to the host
         hostCallback(e);
      } else {
         console.log("Chillhub device successfully created.");

         attachments = attachment;

         // Return the attachment back to the host.
         // The host can now create attachments and then resources.
         hostCallback(null, attachment);

         /*
         attachment.create("milkyWeighs", "31415927", function(e, attachment) {
            if (e) {
               console.log("Error creating attachment.");
               printError(e);
            } else {
               attachment.createResource("name", "rob", function(snap) {
                  console.log("The resource changed in the cloud.");
                  console.log(snap.val());
               }, function(e) {
                  if (e) {
                     console.log("Error adding resource.");
                     printError(e);
                  } else {
                     console.log("Resource added.");
                  }
               });
            }
         });
         */
      }
   });
}

module.exports = {
   startConnection: startConnection
};
