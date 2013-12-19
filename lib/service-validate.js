var origin = require('./util').origin;
var parseUrl = require('url').parse;
var _ = require('underscore');
var formatUrl = require('url').format;
var querystring = require('querystring');
var http = require('http');
var https = require('https');

module.exports = function (overrides) {
    var configuration = require('./configure')();

    return function(req,res,next){

        var options = _.extend({}, overrides, configuration);

        if (!options.host && !options.hostname) throw new Error('no CAS host specified');

        if (!req.session){
            res.send(503);
            return;
        }

        var url = parseUrl(req.url, true);
        var ticket = (url.query && url.query.ticket) ? url.query.ticket : undefined;

        if (ticket) {
            var service = origin(req)

            var validateUri = formatUrl(options) + options.paths.serviceValidate + '?' + querystring.stringify({service: service, ticket: ticket});
            validateTicket(options.protocol, validateUri, req, res, function(body, success){
                if (!success) {
                    if (req.session.st) res.redirect(303, service);
                    else res.redirect(307, formatUrl(options) + options.paths.login + '?' + querystring.stringify({service: service})); 
                    return; 
                }

                req.session.st = ticket;
                // valid user
                if (/<cas:user>(.*)<\/cas:user>/.exec(body)){
                    req.session.name = RegExp.$1;
                }
                res.redirect(303, service);
            });
        } else {
            if (options.gateway){
                if (req.session.gateway) {
                    next();
                } else {
                    req.session.gateway = true;
                    res.redirect(307, formatUrl(options) + options.paths.login + '?' + querystring.stringify({service: origin(req), gateway: true}));
                }
                return;
            }

            if (req.session && req.session.st) {
                next();
                return;
            } 
            if (!req.sessionStore) res.redirect(307, formatUrl(options) + options.paths.login + '?' + querystring.stringify({service: origin(req)}));

            // prevents store from having to save unnecessary session
            req.session.destroy(function(){
                res.redirect(307, formatUrl(options) + options.paths.login + '?' + querystring.stringify({service: origin(req)}));
            });
        }
    }
}
function validateTicket(casProtocol, validateUri, req, res, callback){
    var protocol = (casProtocol === 'http') ? http : https;
    protocol.get(validateUri, function (response) {
        if (response.statusCode !== 200) {
            res.writeHead(403)
            res.end();
        }
        var body = '';
        response.on('data', function(chunk){
            body += chunk;
        });
        response.on('end', function(){
            if (/cas:authenticationSuccess/.exec(body)){
                callback(body, true);
            } else {
                callback(body, false);
            }
        });
    }).on('error', function(e) {
        res.writeHead(403);
        res.end();
    });
}
