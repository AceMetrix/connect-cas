var express = require('express');
var connect = require('connect');
var cas = require('../');
var should = require('should');
var parseUrl = require('url').parse;
var request = require('request').defaults({strictSSL: false, followRedirect: false});
var https = require('https');
var http = require('http');
var q = require('q');
var fs = require('fs');

var lastRequest;
cas.configure({
    protocol: 'http',
    hostname: 'localhost',
    port: 1337
});

describe('#proxyTicket', function(){
    var casServer, server;
    var option = {targetService: 'atyourservice'};
    afterEach(function(done){
        option = {targetService: 'atyourservice'};
        if (casServer){
            casServer.close(function(){
                server.close(done);
            });
        } else done();
    });
    it('exists', function(){
        cas.proxyTicket.should.be.a('function');
    });
    it('is a middleware', function(){
        cas.proxyTicket({targetService: 'atyourservice'}).should.be.a('function');
    });
    it('throws an error when targetService is not specified', function(){
        (function(){cas.proxyTicket()}).should.throw('no target proxy service specified');
    });
    describe('normal case', function(){
        before(function(done){
            option.beforeMiddleware = function(req, res, next){
                req.session.pgt = 'validPGT';
                next();
            };
            casServer = casServerSetup(function(){
                server = serverSetup(option, done); 
            });
        });
        it('sets req.pt', function(done){
            request.get('https://localhost:3000/asdf', function(err, res, body){
                should.exist(lastRequest.session.pt);
                should.exist(lastRequest.session.pt['atyourservice']);
                done();
            });
        });
    });
    describe('when req.session.pt already exists', function(){
        before(function(done){
            option.beforeMiddleware = function(req, res, next){
                req.session.pgt = 'validPGT';
                req.session.pt = {'atyourservice': 'some-PT'}
                next();
            };
            casServer = casServerSetup(function(){
                server = serverSetup(option, done); 
            });
        });

        it('leaves the pt intact when it already exists', function(done){
             request.get('https://localhost:3000/asdf', function(err, res, body){
                lastRequest.session.pt['atyourservice'].should.equal('some-PT');
                done();
            });
        });
    });
    describe('when pgt is not present', function(){
        before(function(done){
            casServer = casServerSetup(function(){
                server = serverSetup(option, done); 
            });
        });

        it('redirects to login', function(done){
             request.get('https://localhost:3000/asdf', function(err, res, body){
                res.statusCode.should.equal(307);
                done();
            });

        });
    });
});

var casServerSetup = function(done){
    var app = express()
    app.get('/cas/proxy', function(req, res){
        var response = '';
        if (req.query.pgt === 'validPGT'){
            res.send('<cas:serviceResponse><cas:proxySuccess><cas:proxyTicket>PT-957-ZuucXqTZ1YcJw81T3dxf</cas:proxyTicket></cas:proxySuccess></cas:serviceResponse>');
        } else {
            res.send('<cas:serviceResponse><cas:proxyFailed></cas:proxyFailed></cas:serviceResponse>');
        }
    });
    var server = http.createServer(app).listen(1337, done);
    server.setTimeout(20);
    return server;
};
var serverSetup = function(options, done){
    var app = express()
    .use(connect.cookieParser())
    .use(connect.session({
        secret: 'ninja cat',
        key: 'sid'
    }))
    if (options.beforeMiddleware) app.use(options.beforeMiddleware);
    app.use(cas.proxyTicket(options));
    if (options.afterMiddleware) app.use(options.afterMiddleware);
    app.use(function(req, res, next){
        lastRequest = req;
        res.send('hello world');
    });
    var server = https.createServer({
        key: fs.readFileSync(__dirname + '/certs/localhost3000.key'),
        cert: fs.readFileSync(__dirname + '/certs/localhost3000.crt')
    }, app).listen(3000, done);
    return server;
};
