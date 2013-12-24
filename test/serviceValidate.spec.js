var express = require('express');
var connect = require('connect');
var cas = require('../');
var should = require('should');
var querystring = require('querystring');
var parseUrl = require('url').parse;
var request = require('request');
var http = require('http');

cas.configure({
    protocol: 'http',
    hostname: 'localhost',
    port: 1337
});

var lastRequest;
describe('#serviceValidate', function(){
    var server;
    before(function(done){
        casServerSetup(function(){
            server = serverSetup('serviceValidate', done); 
        });
    });
    after(function(done){
        server.close(done);
    });
    describe('when ticket presented', function(){
        it('success if ticket valid', function(done){
            request.get({uri: 'http://localhost:3000/somePath?ticket=validTicket', followRedirect: false}, function(err, response){
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('redirect to login when no session and ticket invalid', function(done){
            request.get({uri: 'http://localhost:3000/?ticket=invalidTicket', followRedirect: false}, function(err, response){
                response.statusCode.should.equal(307);
                response.headers.location.should.equal('http://localhost:1337/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2F');
                done();
            });
        });
        it('success if session exists even if ticket invalid', function(done){
            var j = request.jar();
            createSession(j, function(cookie){
                request.get({uri: 'http://localhost:3000/?ticket=invalidTicket', jar: j, followRedirect: false}, function(err, response){
                    response.statusCode.should.equal(200);
                    done();
                });
            });
        });
        it('parses out username with email address format', function(done){
            request.get({uri: 'http://localhost:3000/somePath?ticket=validTicket', followRedirect: false}, function(err, response){
                lastRequest.session.name.should.equal('somebody@gmail.com');
                done();
            });
        });
    });
    describe('when no ticket presented', function(){
        it('continue if session exists', function(done){
            var j = request.jar();
            createSession(j, function(cookie){
                request.get({uri: 'http://localhost:3000/?ticket=invalidTicket', jar: j, followRedirect: false}, function(err, response){
                    response.statusCode.should.equal(200);
                    done();
                });
            });
        });
    });
});

var casServerSetup = function(done){
    var app = express()
    app.get('/cas/serviceValidate', function(req, res){
        var response = '';
        if (req.query.ticket === 'validTicket'){
            response = '<cas:serviceResponse xmlns:cas="http:/www.yale.edu/tp.cas"><cas:authenticationSuccess><cas:user>somebody@gmail.com</cas:user></cas:authenticationSuccess></cas:serviceResponse>';
        } else{
            response = '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationFailure code="INVALID_TICKET">Ticket ST-1856339-aA5Yuvrxzpv8Tau1cYQ7 not recognized</cas:authenticationFailure></cas:serviceResponse>';
        }
        res.end(response);
    });
    app.listen(1337, done);
    return
};
var serverSetup = function(methodName, done){
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
    .use(cas[methodName]())
    .use(cas.authenticate())
    .use(function(req, res, next){
        res.end('hello world');
    });
    var server = http.createServer(app).listen(3000, done);
    server.setTimeout(20);
    return server;
};
var createSession = function(jar, callback) {
    request.get({uri: 'http://localhost:3000/?ticket=validTicket', jar: jar, followRedirect: false}, function(err, res, body){
        callback(res.headers['set-cookie']);
    });
}

