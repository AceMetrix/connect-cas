var should = require('should');
var parseUrl = require('url').parse;
var http = require('http');
var querystring = require('querystring');
var express = require('express');
var connect = require('connect');

var cas = require('../lib/connect-cas');
var options = {
    protocol: 'http',
    hostname: 'localhost',
    port: 1337 
}
cas.configure(options);

// create a fake CAS server
var casServerSetup = function(done){
    var app = express()
    app.get('/cas/serviceValidate', function(req, res){
        var response = '';
        if (req.query.ticket === 'validTicket'){
            response = '<cas:serviceResponse xmlns:cas="http:/www.yale.edu/tp.cas"><cas:authenticationSuccess><cas:user>username</cas:user></cas:authenticationSuccess></cas:serviceResponse>';
        } else{
            response = '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationFailure code="INVALID_TICKET">Ticket ST-1856339-aA5Yuvrxzpv8Tau1cYQ7 not recognized</cas:authenticationFailure></cas:serviceResponse>';
        }
        res.end(response);
    });
    app.listen(1337, done);
    return
};
var createSession = function(callback) {
    http.get('http://localhost:3000/?ticket=validTicket', function(response){
        var data = '';
        response.on('data', function(chunk){
            data += chunk;
        });
        response.on('end', function(){
            callback(response.headers['set-cookie']);
        });
    });
}

var serverSetup = function(methodName, done){
    var app = connect()
    .use(connect.cookieParser('barley wheat napoleon'))
    .use(connect.cookieSession())
    .use(cas[methodName]())
    .use(function(req, res, next){
        res.end('hello world');
    });
    var server = http.createServer(app).listen(3000, done);
    server.setTimeout(20);
    return server;
};

describe('connect-cas',function(){
    var casServer;
    var server;

    before(function(done){
        casServer = casServerSetup(done);
    });
    xdescribe('#configure', function(){});
    describe('#ticket', function(){
        before(function(done){
            server = serverSetup('ticket', done);
        });
        after(function(done){
            server.close(done)
        });
        describe('when ticket is presented', function(){
            describe('and ticket is invalid', function(){
                it('should redirect to login when no session', function(done){
                    http.get('http://localhost:3000/?ticket=invalidTicket', function(response){
                        response.statusCode.should.equal(307);
                        response.headers.location.should.equal('http://localhost:1337/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2F');
                        done();
                    });
                });
                it('should redirect to original url when existing session', function(done){
                    createSession(function(cookie){
                        http.get({host: 'localhost', port: 3000, path: '/?ticket=invalidTicket', headers: {cookie: cookie}}, function(response){
                            response.statusCode.should.equal(303);
                            response.headers.location.should.equal('http://localhost:3000/');
                            done();
                        });
                    });
                });
            });
            it('should redirect to original url when ticket is valid', function(done){
                http.get('http://localhost:3000/somePath?ticket=validTicket', function(response){
                    response.statusCode.should.equal(303);
                    response.headers.location.should.equal('http://localhost:3000/somePath');
                    done();
                });
            });
        });
        describe('when no ticket is presented', function(){
            describe('and gateway is turned off', function(){
                it('should redirect to login when no session', function(done){
                    http.get('http://localhost:3000/?ticket=invalidTicket', function(response){
                        response.statusCode.should.equal(307);
                        response.headers.location.should.equal('http://localhost:1337/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2F');
                        done();
                    });
                });
                it('should continue when existing session', function(done){
                    createSession(function(cookie){
                        http.get({host: 'localhost', port: 3000, headers: {cookie: cookie}}, function(response){
                            response.statusCode.should.equal(200);
                            done();
                        });
                    });
                });
            });
            describe('and gateway is turned on', function(){
                before(function(){
                    cas.configure({gateway: true});
                });
                after(function(){
                    cas.configure({gateway: false});
                });
                it('it should redirect to login with gateway param', function(done){
                    http.get('http://localhost:3000/', function(response){
                        response.statusCode.should.equal(307);
                        var query = querystring.parse(parseUrl(response.headers.location).query);
                        query.gateway.should.equal('true');
                        done();
                    });
                });
                it('should continue if already redirected once with gateway', function(done){
                    http.get('http://localhost:3000', function(response){
                        var cookie = response.headers['set-cookie'];
                        http.get({host: 'localhost', port: 3000, headers: {cookie: cookie}}, function(response){
                            response.statusCode.should.equal(200);
                            done();
                        });
                    });
                });
            });
        });
    });
    xdescribe('#ssout', function(){
        before(function(done){
            server = serverSetup('ssout', done);
        });
        after(function(done){
            server.close(done);
        });
        it('should log the user out when CAS sends POST', function(done){
            var request = http.request({host: 'localhost', port: 3000, method: 'POST'}, function(response){
                response.statusCode.should.equal(204);
                done();
            });
            request.write('<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="12345" Version="2.0" IssueInstant="[CURRENT DATE/TIME]"><saml:NameID>@NOT_USED@</saml:NameID><samlp:SessionIndex>12345</samlp:SessionIndex></samlp:LogoutRequest>');
            request.end();
        });
        it('should allow normal POST to go through', function(done){
              var request = http.request({host: 'localhost', port: 3000, method: 'POST'}, function(response){
                response.statusCode.should.equal(200);
                done();
            });
            request.write('this is cool');
            request.end();
        });
    });
});
