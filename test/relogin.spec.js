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

describe('#relogin', function(){
});
