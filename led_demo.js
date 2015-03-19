// Description:  Using node.js to access data from a chillhub attachment in Firebase.
//               This assumes the use of the ChillHubArduino example from 
//               https://github.com/FirstBuild/ChillHubArduino.git
//               The LED on the Arudino Uno is exposed in Firebase as LED.
//               Analog input A0 is exposed as Analog.
// Author:  Rob Bultman
//          rob@firstbuild.com
// Date: March 11, 2015

//
// Packages...
//
var fs = require('fs');
var firebase = require("firebase");
var Promise = require("promise");
var prompt = require("prompt");
var curry = require("curry");
var fb = {};

//
// Configs
//
var configFile = "./share/chillhub.json";

//
// Globals
//
var ledRef = null;
var analogRef = null;

// Used by printTree to pretty print some object
function makeTabs(num) {
   var rtn = "";

   while(num) {
      rtn += "  ";
      num--;
   }

   return rtn;
}

// Pretty print an object
function printTree(t, depth) {
   for (var key in t) {
      if (typeof(t[key]) == "object") {
         console.log(makeTabs(depth) + key + ": {");
         printTree(t[key], depth+1);
         console.log(makeTabs(depth) + "}");
      } else {
         console.log(makeTabs(depth) + key + ": " + t[key]);
      }
   }
}

// Find a key based on an object.
// Returns the text path to key.
// The value returned can used with ref.child() to access something in firebase.
function findKeyAndReturnPath(obj, searchKey) {
   for (var key in obj) {
      if (key == searchKey) {
         return key;
      }
      if (typeof(obj[key]) == "object") {
         var subSearch = findKeyAndReturnPath(obj[key], searchKey);
         if (subSearch != null) {
            return key + '/' + subSearch;
         }
      }
   }
   return null;
}

function findKeyAndReturnRef(snap, searchKey) {
   var ref = null;
   snap.forEach(function(childSnap) {
      if (childSnap.hasChildren()) {
         ref = findKeyAndReturnRef(childSnap, searchKey);
      } else {
         if (childSnap.key() == searchKey) {
            ref = childSnap.ref();
            return true;
         }
      }
   });
   return ref;
}

var findResource = curry(function (snap, name) {
   var p = new Promise(function(resolve, reject) {
      var ref = null;
      console.log("Trying to find " + name + "...");
      ref = findKeyAndReturnRef(snap, name);
      if (ref == null) {
         reject(new Error("Did not find " + name));
      } else {
         console.log(name + " found here: " + ref.toString());
         ref.once("value", function(snap) {
            console.log(snap.key() + " = " + snap.val());
            resolve(ref);
         });
      }
   });

   return p;
});

function findResources(snap) {
   var p = new Promise(function(resolve, reject) {
      var findIt = findResource(snap);
      var resourceNames = ["LED", "Analog"];
      Promise.all(resourceNames.map(findIt)).done(function(results) {
         ledRef = results[0];
         analogRef = results[1];
         resolve();
      }, function(err) {
         reject(err);
      });
   });

   return p;
}

function findChillhubs(ref) {
   var p = new Promise(function(resolve, reject) {
      var ch = ref.child("devices").child("chillhubs");
      ch.once("value", function(snap) {
         resolve(snap);
      });
   });

   return p;
}

function openFirebase(args) {
   var p = new Promise(function(resolve, reject) {
      fb = new firebase(args.firebaseUrl);
      fb.authWithCustomToken(args.token, function(e, auth) {
         if (e) {
            reject(new Error("Error opening a connection to firebase."));
         }
         else {
            var uid = auth.uid;
            console.log("Firebase connection open.");
            myRoot = fb.child("users/" + uid);
            resolve(myRoot);
         }
      });
   });

   return p;
}

// Read the config file.
// The config file is created when a chillhub is registered.
// The credentials needed to connect to firebase a stored here.
function readConfigFile() {
   var p = new Promise(function(resolve, reject) {
      fs.readFile(configFile, function(e, data) {
         var ver = "UNKNOWN";
         if (e) {
            console.log("Error opening " + configFile + ".");
            reject(e);
         } else {
            console.log("Config file opened.");
            var obj = JSON.parse(data);
            // get the connection token
            if (obj.token) {
               token = obj.token;
            } else {
               reject(new Error("Firebase connection token not found in config file."));
            }
            // get the firebase url
            if (obj.firebaseUrl) {
               url = obj.firebaseUrl;
            } else {
               reject(new Error("Firebase URL not found in config file."));
            }
            resolve(obj);
         }
      });
   });

   return p;
}

function runUserInput() {

   console.log("\r\nSelect from the menu below.");
   console.log("1) Toggle LED");
   console.log("2) Turn LED on");
   console.log("3) Turn LED off");
   console.log("4) Read analog value");
   console.log("5) Quit");
   prompt.get(['selection'], function (err, result) {
      switch(result.selection) {
         case '1':
            ledRef.once("value", function(snap) {
               console.log(snap.key() + " = " + snap.val());
               var i = snap.val();
               i++;
               i &= 0x01;
               ledRef.set(i);
               runUserInput(); 
            });
            return;
            break;
         case '2':
            ledRef.set(1);
            break;
         case '3':
            ledRef.set(0);
            break;
         case '4':
            analogRef.once("value", function(snap) {
               console.log(snap.key() + " = " + snap.val());
               runUserInput(); 
            });
            return;
            break;
         case '5':
            console.log("Exiting...");
            firebase.goOffline();
            process.exit(0);
            return;
            break;
         default:
            console.log("Unknown input: " + result.selection);
            break;
      }
      runUserInput(); 
   });
}

function startupComplete() {
   console.log("Got it all successfully.");
   console.log("LED: " + ledRef.toString());
   console.log("Analog: " + analogRef.toString());
   prompt.start();
   runUserInput();
}

readConfigFile()
   .then(openFirebase)
   .then(findChillhubs)
   .then(findResources)
   .done(startupComplete, function (err) {
      console.log("Some error occurred: " + err);
   });
