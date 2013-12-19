var express = require('express');
var connect = require('connect');
var cas = require('../');
var http = require('http');
var should = require('should');
var querystring = require('querystring');
var parseUrl = require('url').parse;

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
        describe('and ticket invalid', function(){
            it('redirect to login when no session', function(done){
                http.get('http://localhost:3000/?ticket=invalidTicket', function(response){
                    response.statusCode.should.equal(307);
                    response.headers.location.should.equal('http://localhost:1337/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2F');
                    done();
                });
            });
            it('redirect to original url if session exists', function(done){
                createSession(function(cookie){
                    http.get({host: 'localhost', port: 3000, path: '/?ticket=invalidTicket', headers: {cookie: cookie}}, function(response){
                        response.statusCode.should.equal(303);
                        response.headers.location.should.equal('http://localhost:3000/');
                        done();
                    });
                });
            });
        });
        it('redirects to original url if ticket valid', function(done){
            http.get('http://localhost:3000/somePath?ticket=validTicket', function(response){
                response.statusCode.should.equal(303);
                response.headers.location.should.equal('http://localhost:3000/somePath');
                done();
            });
        });
        it('retains the original querystring except for ?ticket', function(done){
            http.get('http://localhost:3000/somePath?ticket=validTicket&keepme=alive', function(response){
                response.statusCode.should.equal(303);
                response.headers.location.should.equal('http://localhost:3000/somePath?keepme=alive');
                done();
            });
        });
        it('parses out username with email address format', function(done){
            http.get('http://localhost:3000/somePath?ticket=validTicket', function(response){
                lastRequest.session.name.should.equal('somebody@gmail.com');
                done();
            });
        });
    });
    describe('when no ticket presented', function(){
        describe('and gateway turned off', function(){
            it('redirect to login when no session', function(done){
                http.get('http://localhost:3000/', function(response){
                    response.statusCode.should.equal(307);
                    response.headers.location.should.equal('http://localhost:1337/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2F');
                    should.not.exist(response.headers['set-cookie']);
                    done();
                });
            });
            it('continue if session exists', function(done){
                createSession(function(cookie){
                    http.get({host: 'localhost', port: 3000, headers: {cookie: cookie}}, function(response){
                        response.statusCode.should.equal(200);
                        done();
                    });
                });
            });
        });
        describe('and gateway turned on', function(){
            before(function(){
                cas.configure({gateway: true});
            });
            after(function(){
                cas.configure({gateway: false});
            });
            it('redirect to login with gateway param', function(done){
                http.get('http://localhost:3000/', function(response){
                    response.statusCode.should.equal(307);
                    var query = querystring.parse(parseUrl(response.headers.location).query);
                    query.gateway.should.equal('true');
                    done();
                });
            });
            it('continue if already redirected', function(done){
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
    .use(function(req, res, next){
        res.end('hello world');
    });
    var server = http.createServer(app).listen(3000, done);
    server.setTimeout(20);
    return server;
};
var createSession = function(callback) {
    http.get('http://localhost:3000/?ticket=validTicket', function(response){
        callback(response.headers['set-cookie']);
    });
}

