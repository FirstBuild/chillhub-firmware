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

function login(Firebase, Date, token, callback) {
  if (callback) {
    if (token) {
      var firebase = new Firebase('https://mobius-firstbuild.firebaseio.com');
      
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
            software_version: software_version
          };
          
          var chillhub = firebase
            .child('users').child(uid)
            .child('devices').child('chillhubs').child(uuid);
          
          chillhub.update(value, function(e) {
            if (e) {
              callback(new FirebaseUpdateError(e));
            }
            else {
               var obj = {
                create: createAttachment.curry(chillhub),
                chillhub: chillhub
               }
              callback(null, obj);
            }
          });
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

var createAttachment = function(root, type, uuid, callback) {
   if (callback) {
      if (uuid) {
         if (type) {
            var attachment = root.child(type).child(uuid);
            callback(null, {
               createResource: createAttachmentResource.curry(attachment)
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
   if (callback) {
      if (initialValue) {
         if (key) {
            // onChange is not required.
            attachment.once("value", function(snap) {
               var obj = snap.val();
               if (!obj) {
                  obj = {};
               }
               obj[key] = initialValue;
               attachment.update(obj, function(e) {
                  if (e) {
                     callback(new FirebaseUpdateError('resource'));
                  } else {
                     if (onChange) {
                        attachment.child(key).on("value", onChange);
                     }
                     callback(null);
                  }
               });
            });
            
         } else {
            callback(new UndefinedPropertyError('key'));
         }
      } else {
         callback(new UndefinedPropertyError('initialValue'));
      }
   } else {
      throw new UndefinedPropertyError('callback');
   }
}
