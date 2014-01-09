var express = require('express');
var connect = require('connect');
var cas = require('../');
var should = require('should');
var parseUrl = require('url').parse;
var request = require('request');
var http = require('http');
var q = require('q');

cas.configure({
    protocol: 'http',
    hostname: 'localhost',
    port: 1337
});

var lastRequest;
describe('#proxyValidate', function(){
        var casServer, server;
        before(function(done){
            casServer = casServerSetup(done);
        });
        after(function(done){
            casServer.close(done);
        });
    it('exists', function(){
        cas.proxyTicket.should.be.a('function');
    });
    it('returns a promise', function(){
        q.isPromise(cas.proxyTicket({targetService: 'asdf', pgt: 'asdf'})).should.be.true;
    });
    it('resolves the promise when proxy success', function(done){
        cas.proxyTicket({targetService: 'asdf', pgt: 'validPGT'})
        .then(function(pt){
            should.exist(pt);
            pt.should.be.a('string');
            done();
        });
    });
    it('executes optional callback when proxy success', function(done){
        cas.proxyTicket({targetService: 'asdf', pgt: 'validPGT'}, function(err, pt){
            should.not.exist(err);
            should.exist(pt);
            pt.should.be.a('string');
            done();
        });
    });
    it('rejects the promise when proxy failure', function(done){
        cas.proxyTicket({targetService: 'asdf', pgt: 'invalidPGT'})
        .fail(function(err){
            should.exist(err);
            done();
        });
    });
    it('executes callback with error when proxy failed', function(done){
        cas.proxyTicket({targetService: 'asdf', pgt: 'invalidPGT'}, function(err, pt){
            should.exist(err);
            done();
        });
    });
    it('throws an error when targetService is not specified', function(){
        (function(){cas.proxyTicket({pgt: 'asdf'})}).should.throw('no target proxy service specified');
    });
    it('throws an error when pgt is not specified', function(){
        (function(){cas.proxyTicket({targetService: 'asdf'})}).should.throw('no proxy granting ticket specified');
    });
});

var casServerSetup = function(done){
    var app = express()
    app.get('/cas/proxy', function(req, res){
        var response = '';
        if (req.query.pgt === 'validPGT'){
            res.send('<cas:serviceResponse><cas:proxySuccess><cas:proxyTicket>PT-957-ZuucXqTZ1YcJw81T3dxf</cas:proxyTicket></cas:proxySuccess></cas:serviceResponse>');
        } else {
            res.send('<cas:serviceResponse><cas:proxyFailed></cas:procyFailed></cas:serviceResponse>');
        }
    });
    var server = http.createServer(app).listen(1337, done);
    server.setTimeout(20);
    return server;
};
