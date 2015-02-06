Function.prototype.curry = function() {
  var fun = this;
  var args = [].slice.call(arguments, 0);
  
  return function() {
    return fun.apply(this,
      args.concat([].slice.call(arguments, 0)));
  };
}

var chillhub = module.exports = function(Firebase, Date) {
  return {
    login: login.curry(Firebase, Date)
  };
};

function UndefinedPropertyError(property) {
  this.kind = 'error#undefined-property';
  this.property = property;
}

function FirebaseAuthWithCustomTokenError(error) {
  this.kind = 'error#firebase';
  this.method = 'authWithCustomToken';
  this.error = error;
}

function FirebaseUpdateError(error) {
  this.kind = 'error#firebase';
  this.method = 'update';
  this.error = error;
}

function login(Firebase, Date, token, url, callback) {
  if (callback) {
    if (token) {
      var firebase = new Firebase(url);
      
      firebase.authWithCustomToken(token, function(e, auth) {
        if (e) {
          callback(new FirebaseAuthWithCustomTokenError(e));
        }
        else {
          var uid = auth.uid;
          
          callback(null, {
            uid: uid,
            create: createChillHub.curry(Date, firebase, uid)
          });
        }
      });
    }
    else {
      callback(new UndefinedPropertyError('token'));
    }
  }
  else {
    throw new UndefinedPropertyError('callback');
  }
}

function createChillHub(Date, firebase, uid, uuid, hardware_version, software_version, callback) {
  if (callback) {
    if (uuid) {
      if (hardware_version) {
        if (software_version) {
          var now = new Date().toISOString();
          
          var value = {
            created: now,
            updated: now,
            hardware_version: hardware_version,
            software_version: software_version,
            "status": "connected"
          };
          
          var chillhub = firebase
            .child('users').child(uid)
            .child('devices').child('chillhubs').child(uuid);

          var setStatus = function(status) {
            var value = {
               "status" : status
            }
            chillhub.update(value, function(err) {
               if (err) {
                  console.log("Error setting status to " + status);
               } 
            });
          } 

          var errorGettingRoot = function(err) {
            console.log("Error getting chillhub root. " + err);
          }

          var register = function(value) {
             chillhub.update(value, function(e) {
                if (e) {
                   callback(new FirebaseUpdateError(e));
                }
                else {
                   var obj = {
                      create: createAttachment.curry(chillhub),
                      chillhub: chillhub,
                      setStatus: setStatus
                   }
                   callback(null, obj);
                }
             });
          }

          var getDevicesFromDeviceTypeSnapshot = function(types) {
             var devices = [];
             for (var i=0; i<types.length; i++) {
               types[i].forEach(function(childSnap) {
                  if (childSnap.hasChildren()) {
                     devices.push(childSnap);
                  }
               });
             }
             return devices;
          }

          var getDevicesFromRootSnapshot = function(rootSnap) {
             var deviceTypeSnaps = [];
             if (rootSnap.hasChildren()) {
                rootSnap.forEach(function(childSnap){
                   if (childSnap.hasChildren()) {
                      deviceTypeSnaps.push(childSnap);
                   }
                });
             }
             return getDevicesFromDeviceTypeSnapshot(deviceTypeSnaps);
          }

          var setDevicesToDisconnected = function(root) {
            var status = {"status": "disconnected"};
            var devices = getDevicesFromRootSnapshot(root);
            for (var i=0; i<devices.length; i++) {
               devices[i].ref().update(status);
            }
          }

          var gotRoot = function(rootSnap) {
             if (rootSnap.val() != null) {
                // This chillhub is on firebase already.
                // Use the old created and updated times.
                // Update the HW and SW versions to newest.
                value.created = rootSnap.val().created;
                value.updated = rootSnap.val().updated;
                setDevicesToDisconnected(rootSnap);
                rootSnap.ref().onDisconnect().update({"status": "disconnected"});
                register(value);
             } else {
                register(value);
             }
          }

          // See if this chillhub is already on firebase.
          chillhub.once("value", gotRoot, errorGettingRoot);
          
        }
        else {
          callback(new UndefinedPropertyError('software_version'));
        }
      }
      else {
        callback(new UndefinedPropertyError('hardware_version'));
      }
    }
    else {
      callback(new UndefinedPropertyError('uuid'));
    }
  }
  else {
    throw new UndefinedPropertyError('callback');
  }
}

var setAttachmentStatus = function(attachment, status) {
   var value = {
      "status" : status
   }
   attachment.update(value, function(err) {
      if (err) {
         console.log("Error setting status to " + status);
      }
   });
}  

var createAttachment = function(root, type, uuid, callback) {
   if (callback) {
      if (uuid) {
         if (type) {
            var attachment = root.child(type).child(uuid);
            // See if the child is already registered.
            console.log("Checking to see if attachment exists in firebase.");
            var now = new Date().toISOString();
            attachment.once('value', 
                  function(snap) {
                     var value = {
                        "created": now,
                        "status": "connected"
                     }
                     if (snap.val() != null) {
                        console.log("Attachment does exist.");
                        value.created = snap.val().created;
                     } else {
                        console.log("Attachment does not exist.");
                     }
                     attachment.update(value);
                     callback(null, {
                        createResource: createAttachmentResource.curry(attachment),
                        setStatus: setAttachmentStatus.curry(attachment)
                     });
                  },
                  function(err) {
                     console.log("Error getting attachment info.");
                  });
         } else {
            callback(new UndefinedPropertyError('type'));
         }
      } else {
         callback(new UndefinedPropertyError('uuid'));
      }
   } else {
      throw new UndefinedPropertyError('callback');
   }
}

var createAttachmentResource = function(attachment, key, initialValue, onChange, callback) {
   if (callback === undefined) {
      throw new UndefinedPropertyError('callback');
   } else if (initialValue === undefined) {
      callback(new UndefinedPropertyError('initialValue'));
   } else if (key === undefined) {
      callback(new UndefinedPropertyError('key'));
   } else if (onChange === undefined) {
      callback(new UndefinedPropertyError('onChange'));
   } else {
      attachment.transaction(function(currentdata) {
         if(currentdata == null) {
            return{key: initialValue};
         } else {
            currentdata[key] = initialValue;
            return currentdata;
         }

      }, function(error, committed, snap) {
         if (error) {
            console.log("Resource creation transaction failed for resource " + key);
         } else if (!committed) {
            console.log("Looks like we aborted the creation transaction for resource " + key);
         } else {
            if (onChange) {
               attachment.child(key).on("value", onChange);
            }
            callback(null, attachment);
         }
      });
      return;
   }
}
