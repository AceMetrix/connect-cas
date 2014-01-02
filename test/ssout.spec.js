var express = require('express');
var connect = require('connect');
var request = require('request');
var cas = require('../');
var http = require('http');
var should = require('should');

describe('#ssout', function(){
    var server;
    before(function(done){
        server = serverSetup(done); 
    });
    after(function(done){
        server.close(done);
    });
    it('logs the user out when CAS sends POST', function(done){
        request.post({uri: 'http://localhost:3000/cas/logout', body: '<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="12345" Version="2.0" IssueInstant="[CURRENT DATE/TIME]"><saml:NameID>@NOT_USED@</saml:NameID><samlp:SessionIndex>12345</samlp:SessionIndex></samlp:LogoutRequest>'}, function(err, res, body){
            res.statusCode.should.equal(204);
            done();
        });
    });
    it('continues to next() when different endpoint', function(done){
        request.post({uri: 'http://localhost:3000/cas/blah', body: '<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="12345" Version="2.0" IssueInstant="[CURRENT DATE/TIME]"><saml:NameID>@NOT_USED@</saml:NameID><samlp:SessionIndex>12345</samlp:SessionIndex></samlp:LogoutRequest>'}, function(err, res, body){
            res.statusCode.should.equal(307);
            done();
        });
    });
    it('continues to next() when different method', function(done){
        request.put({uri: 'http://localhost:3000/cas/blah', body: '<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="12345" Version="2.0" IssueInstant="[CURRENT DATE/TIME]"><saml:NameID>@NOT_USED@</saml:NameID><samlp:SessionIndex>12345</samlp:SessionIndex></samlp:LogoutRequest>'}, function(err, res, body){
            res.statusCode.should.equal(307);
            done();
        });
    });
    it('continues to next() when unexpected body response', function(done){
        request.put({uri: 'http://localhost:3000/cas/blah', body: 'hello'}, function(err, res, body){
            res.statusCode.should.equal(307);
            done();
        });
    });
});

var serverSetup = function(done){
    var app = express()
    .use(connect.cookieParser())
    .use(connect.session({
        secret: 'ninja cat',
        key: 'sid'
    }))
    .use(function(req, res, next){
        lastRequest = req;
        next();
    })
    .use(cas.ssout('/cas/logout'))
    .use(cas.authenticate())
    .use(function(req, res, next){
        res.end('hello world');
    });
    var server = http.createServer(app).listen(3000, done);
    server.setTimeout(20);
    return server;
};
