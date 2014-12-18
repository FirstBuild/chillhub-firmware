var should = require('should');
var chillhub = require('../lib/chillhub.js');

function Firebase() { }

Firebase.prototype.authWithCustomToken = function(token, callback) {
  callback(null, { uid: 'uid' });     
};

describe('chillhub.login(token, callback)', function() {
  var token;
  
  beforeEach(function() {
    token = 'token';
  })
  
  describe('when the callback is undefined', function() { 
    it('should throw an error', function(done) {
      try {
        chillhub(Firebase).login(token);
      }
      catch (e) {
        should(e).eql({
          kind: 'error#undefined-property',
          property: 'callback'
        });
        
        done();
      }
    })
  })
  
  describe('when the token is undefined', function() {
    beforeEach(function() {
      token = undefined;
    })
    
    it('should return an error', function(done) {
      chillhub(Firebase).login(token, function(e) {
        should(e).eql({
          kind: 'error#undefined-property',
          property: 'token'
        });
        
        done();
      });
    })
  })
  
  describe('when the token is defined', function() {
    it('should login to Firebase', function(done) {
      function Firebase(url) {
        should(url).eql('https://mobius-firstbuild.firebaseio.com');
      }
      
      Firebase.prototype.authWithCustomToken = function(token, callback) {
        should(token).eql('token');
        done();
      };
      
      chillhub(Firebase).login(token, function(e) {
        
      });
    })
    
    describe('when Firebase returns an error', function() {
      function Firebase() { }
      
      Firebase.prototype.authWithCustomToken = function(token, callback) {
        callback('reason');
      };
      
      it('should return the error', function(done) {
        chillhub(Firebase).login(token, function(e) {
          should(e).eql({
            kind: 'error#firebase',
            method: 'authWithCustomToken',
            error: 'reason'
          });
          
          done();
        });
      })
    })
    
    describe('when Firebase returns without error', function() {
      it('should return the user session', function(done) {
        chillhub(Firebase).login(token, function(e, session) {
          should(e).not.be.ok;
          should(session).have.property('uid', 'uid');
          done();
        });
      })
      
      
    })
  })
})