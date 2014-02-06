var express = require('express');
var connect = require('connect');
var cas = require('../');
var should = require('should');
var parseUrl = require('url').parse;
var request = require('request').defaults({followRedirect: false, strictSSL: false});
var https = require('https');
var fs = require('fs');
var http = require('http');

cas.configure({
    protocol: 'http',
    hostname: 'localhost',
    port: 1337
});

var lastRequest;
describe('#serviceValidate', function(){
    describe('ticket authentication', function(){
        var casServer, server;
        before(function(done){
            casServer = casServerSetup(function(){
                server = serverSetup(null, done);
            });
        });
        after(function(done){
            casServer.close(function(){
                server.close(done);
            });
        });

        describe('when ticket presented', function(){
            it('success if ticket valid', function(done){
                request.get('https://localhost:3000/somePath?ticket=validTicket', function(err, response){
                    response.statusCode.should.equal(200);
                    done();
                });
            });
            it('gets a new service ticket even when one exists', function(done){
                var j = request.jar();
                request.get({uri: 'https://localhost:3000/?ticket=validTicket', jar: j}, function(err, res){
                    lastRequest.session.st.should.equal('validTicket');
                    request.get({uri: 'https://localhost:3000/?ticket=validTicket2', jar: j}, function(err, res){
                        lastRequest.session.st.should.equal('validTicket2');
                        done();
                    });
                });
            });
            it('redirect to login when no session and ticket invalid', function(done){
                request.get({uri: 'https://localhost:3000/?ticket=invalidTicket', followRedirect: false}, function(err, response){
                    response.statusCode.should.equal(307);
                    response.headers.location.should.equal('http://localhost:1337/cas/login?service=https%3A%2F%2Flocalhost%3A3000%2F');
                    done();
                });
            });
            it('success if session exists even if ticket invalid', function(done){
                var j = request.jar();
                createSession(j, function(cookie){
                    request.get({uri: 'https://localhost:3000/?ticket=invalidTicket', jar: j, followRedirect: false}, function(err, response){
                        response.statusCode.should.equal(200);
                        done();
                    });
                });
            });
            it('parses out username with email address format', function(done){
                request.get({uri: 'https://localhost:3000/somePath?ticket=validTicket', followRedirect: false}, function(err, response){
                    lastRequest.session.cas.user.should.equal('somebody@gmail.com');
                    done();
                });
            });
            it('stores arbitrary values into req.session coming from cas', function(done){
                request.get({uri: 'https://localhost:3000/somePath?ticket=validTicket', followRedirect: false}, function(err, response){
                    lastRequest.session.cas.should.be.an.Object;
                    lastRequest.session.cas.user.should.equal('somebody@gmail.com');
                    lastRequest.session.cas.blah.should.equal('somevalue');
                    done();
                });
            });
        });
        describe('when no ticket presented', function(){
            it('continues if session exists', function(done){
                var j = request.jar();
                createSession(j, function(cookie){
                    request.get({uri: 'https://localhost:3000/', jar: j, followRedirect: false}, function(err, response){
                        response.statusCode.should.equal(200);
                        done();
                    });
                });
            });
            it('redirects if no session exists', function(done){
                request.get({uri: 'https://localhost:3000/?ticket=invalidTicket', followRedirect: false}, function(err, response){
                    response.statusCode.should.equal(307);
                    done();
                });
            });
            it('keeps the querystring parameters during the redirect', function(done){
                request.get({uri: 'https://localhost:3000/?randomquerystring=true', followRedirect: false}, function(err, response){
                    response.statusCode.should.equal(307);
                    response.headers.location.should.equal('http://localhost:1337/cas/login?service=https%3A%2F%2Flocalhost%3A3000%2F%3Frandomquerystring%3Dtrue');
                    done();
                });
            });
        });
    });
    describe('proxy authentication', function(){
        describe('absolute callback', function(){
            var casServer, server;
            before(function(done){
                casServer = casServerSetup(function(){
                    server = serverSetup({pgtUrl: 'https://localhost:3000/pgtCallback'}, done); 
                });
            });
            after(function(done){
                casServer.close(function(){
                    server.close(done);
                });
            });
            it('serves the callback when defined', function(done){
                request.get('https://localhost:3000/pgtCallback?ticket=validTicket&pgtIou=blah&pgtId=blah', function(err, res, body){
                    res.statusCode.should.equal(200);
                    body.should.equal('OK');
                    done();
                });
            });
            it('throws an error when pgtUrl is http', function(){
                var mockReq = {session: {}, url: 'blah', query: {ticket: 'blah'}, get: function(){}};
                (function(){
                    cas.serviceValidate({pgtUrl: 'http://localhost:3000/pgtCallback'})(mockReq);
                }).should.throw('callback must be secured with https');
            });
        });
        describe('absolute callback with pgtFn', function(){
            var casServer, server, pgtCallback = false;
            before(function(done){
                casServer = casServerSetup(function(){
                    server = serverSetup({pgtUrl: 'https://localhost:3000/pgtCallback', pgtFn: function(pgtIou, cb){
                        pgtCallback = true;
                        setTimeout(function(){
                            cb(null, 'some-pgtId');
                        }, 1);
                    }}, done); 
                });
            });
            after(function(done){
                pgtCallback = false;
                casServer.close(function(){
                    server.close(done);
                });
            });
            it('doesn\'t serve the callback when pgtFn defined', function(done){
                request.get('https://localhost:3000/pgtCallback?ticket=validTicket&pgtIou=blah&pgtId=blah', function(err, res, body){
                    res.statusCode.should.equal(200);
                    body.should.equal('hello world'); // normally the callback returns a blank 200
                    done();
                });
            });
            it('calls the pgtFn when defined', function(done){
                request.get('https://localhost:3000/pgtCallback?ticket=validTicket', function(err, res, body){
                    pgtCallback.should.be.true;
                    lastRequest.session.pgt.should.equal('some-pgtId');
                    done();
                });
            });
            it('throws an error when pgtFn defined without the pgtUrl', function(){
                (function(){
                    cas.serviceValidate({pgtFn: function(){}})();
                }).should.throw('pgtUrl must be specified for obtaining proxy tickets');
            });
        });
        describe('relative callback', function(){
            var casServer, server;
            before(function(done){
                casServer = casServerSetup(function(){
                    server = serverSetup({pgtUrl: '/pgtCallback'}, done); 
                });
            });
            after(function(done){
                casServer.close(function(){
                    server.close(done);
                });
            });

            it('returns with a 200 when hitting the pgtUrl', function(done){
                request.get({uri: 'https://localhost:3000/pgtCallback?ticket=validTicket'}, function(err, res, body){
                    res.statusCode.should.equal(200);
                    done();
                });
            });
            it('sets req.session.pgt', function(done){
                request.get('https://localhost:3000/?ticket=validTicket', function(err, res, body){
                    should.exist(lastRequest.session.pgt);
                    done();
                });
            });
            it('gets a new proxy granting ticket even when one exists', function(done){
                var j = request.jar();
                request.get({uri: 'https://localhost:3000/?ticket=validTicket', jar: j}, function(err, res){
                    var firstRequest = lastRequest;
                    request.get({uri: 'https://localhost:3000/?ticket=validTicket2', jar: j}, function(err, res){
                        lastRequest.session.pgt.should.not.equal(firstRequest.session.pgt);
                        done();
                    });
                });
            });
        });
    });
});

var casServerSetup = function(done){
    var counter = 0;
    var app = express()
    app.get('/cas/serviceValidate', function(req, res){
        var response = '';
        if (/^validTicket/.exec(req.query.ticket)){
            response = '<cas:serviceResponse xmlns:cas="https:/www.yale.edu/tp.cas"><cas:authenticationSuccess><cas:user>somebody@gmail.com</cas:user><cas:blah>somevalue</cas:blah>';
            if (req.query.pgtUrl) {
                response += '<cas:proxyGrantingTicket>ioualottamoney</cas:proxyGrantingTicket>';
                response += '</cas:authenticationSuccess></cas:serviceResponse>';
                request.get(req.query.pgtUrl + '?pgtIou=ioualottamoney&pgtId=hello' + counter++, function(){
                    res.end(response);
                });
                return;
            }
            response += '</cas:authenticationSuccess></cas:serviceResponse>';
        } else {
            response = '<cas:serviceResponse xmlns:cas="https://www.yale.edu/tp/cas"><cas:authenticationFailure code="INVALID_TICKET">Ticket ST-1856339-aA5Yuvrxzpv8Tau1cYQ7 not recognized</cas:authenticationFailure></cas:serviceResponse>';
        }
        res.end(response);
    });
    var server = http.createServer(app).listen(1337, done);
    server.setTimeout(50);
    return server;
};
var serverSetup = function(options, done){
    var app = express()
    .use(connect.cookieParser())
    .use(connect.session({
        secret: 'ninja cat',
        key: 'sid'
    }))
    if (options) app.use(cas.serviceValidate(options))
    else app.use(cas.serviceValidate())

    app.use(function(req, res, next){
        lastRequest = req;
        next();
    })
    .use(cas.authenticate())
    .use(function(req, res, next){
        res.end('hello world');
    });
    var server = https.createServer({
        key: fs.readFileSync(__dirname + '/certs/localhost3000.key'),
        cert: fs.readFileSync(__dirname + '/certs/localhost3000.crt')
    }, app).listen(3000, done);
    //server.setTimeout(20);
    return server;
};
var createSession = function(jar, callback) {
    request.get({uri: 'https://localhost:3000/?ticket=validTicket', jar: jar, followRedirect: false}, function(err, res, body){
        callback(res.headers['set-cookie']);
    });
}

