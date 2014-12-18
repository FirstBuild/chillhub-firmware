var should = require('should');
var chillhub = require('../lib/chillhub.js');

function Firebase() { }

Firebase.prototype.authWithCustomToken = function(token, callback) {
  callback(null, { uid: 'uid' });
};

Firebase.prototype.child = function() {
  return this;
};

Firebase.prototype.update = function() { };

function FirebaseUpdate(callback) {
  function Firebase(url, children) {
    this.url = url;
    this.children = children || [];
  }

  Firebase.prototype.authWithCustomToken = function(token, callback) {
    callback(null, { uid: 'uid' });
  };

  Firebase.prototype.child = function(name) {
    return new Firebase(this.url, this.children.concat(name));
  };
  
  Firebase.prototype.update = function(value) {
    callback('/' + this.children.join('/'), value);
  };
  
  return Firebase;
}

describe('chillhub.create(uuid, hardware_version, software_version, callback)', function() {
  var token, uuid, hardware_version, software_version;
  
  beforeEach(function() {
    token = 'token';
    uuid = 'uuid';
    hardware_version = '0.0.0';
    software_version = '1.0.0';
  })
  
  describe('when the callback is undefined', function() { 
    it('should throw an error', function(done) {
      chillhub(Firebase).login(token, function(e, hub) {
        try {
          hub.create(uuid, hardware_version, software_version);
        }
        catch (e) {
          should(e).eql({
            kind: 'error#undefined-property',
            property: 'callback'
          });

          done();
        }
      });
    })
  })
  
  describe('when the uuid is undefined', function() {
    beforeEach(function() {
      uuid = undefined;
    })
    
    it('should return an error', function(done) {
      chillhub(Firebase).login(token, function(e, hub) {
        hub.create(uuid, hardware_version, software_version, function(e) {
          should(e).eql({
            kind: 'error#undefined-property',
            property: 'uuid'
          });

          done();
        });
      });
    })
  })
  
  describe('when the hardware version is undefined', function() {
    beforeEach(function() {
      hardware_version = undefined;
    })
    
    it('should return an error', function(done) {
      chillhub(Firebase).login(token, function(e, hub) {
        hub.create(uuid, hardware_version, software_version, function(e) {
          should(e).eql({
            kind: 'error#undefined-property',
            property: 'hardware_version'
          });

          done();
        });
      });
    })
  })
  
  describe('when the software version is undefined', function() {
    beforeEach(function() {
      software_version = undefined;
    })
    
    it('should return an error', function(done) {
      chillhub(Firebase).login(token, function(e, hub) {
        hub.create(uuid, hardware_version, software_version, function(e) {
          should(e).eql({
            kind: 'error#undefined-property',
            property: 'software_version'
          });

          done();
        });
      });
    })
  })
  
  describe('when the arguments are defined', function() {
    it('should update Firebase', function(done) {
      function Date() { }
      
      Date.prototype.toISOString = function() {
        return '2000-01-01T00:00:00.000Z';
      };
      
      var Firebase = FirebaseUpdate(function(path, value) {
        should(path).eql('/users/uid/devices/chillhubs/uuid');
        
        should(value).eql({
          hardware_version: '0.0.0',
          software_version: '1.0.0',
          created: '2000-01-01T00:00:00.000Z',
          updated: '2000-01-01T00:00:00.000Z'
        });
        
        done();
      });
      
      chillhub(Firebase, Date).login(token, function(e, hub) {
        hub.create(uuid, hardware_version, software_version, function(e) {
          
        });
      });
    })
    
    describe('when Firebase returns an error', function() {
      function Firebase() { }

      Firebase.prototype.authWithCustomToken = function(token, callback) {
        callback(null, { uid: 'uid' });
      };

      Firebase.prototype.child = function() {
        return this;
      };

      Firebase.prototype.update = function(value, callback) {
        callback('reason');
      };
      
      it('should return an error', function(done) {
        chillhub(Firebase, Date).login(token, function(e, hub) {
          hub.create(uuid, hardware_version, software_version, function(e) {
            should(e).eql({
              kind: 'error#firebase',
              method: 'update',
              error: 'reason'
            });
            
            done();
          });
        });
      })
    })
  })
})
