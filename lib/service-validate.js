var origin = require('./util').origin;
var parseUrl = require('url').parse;
var _ = require('lodash');
var formatUrl = require('url').format;
var qs = require('querystring');
var request = require('request');

module.exports = function (overrides) {
    var configuration = require('./configure')();
    var options = _.extend({}, overrides, configuration);

    return function(req,res,next){
        if (!options.host && !options.hostname) throw new Error('no CAS host specified');

        if (!req.session){
            res.send(503);
            return;
        }

        var url = parseUrl(req.url, true);
        var ticket = (url.query && url.query.ticket) ? url.query.ticket : null;

        if (!ticket) next();

        options.query = options.query || {};
        options.query.service = origin(req);
        options.query.ticket = ticket;
        options.pathname = options.paths.serviceValidate;

        if (options.query.pgtUrl) {
            // handle pgt callback
            if (req.method === 'GET' && req.path === formatUrl(options.query.pgtUrl).pathname){
                req.sessionStore.set(req.query.pgtIou, req.query.pgtId)
                res.send(204);
                return;
            }
        }

        var validateUri = formatUrl(options);

        request.get(formatUrl(options), function(err, casRes, casBody){
            if (err || casRes.statusCode !== 200){
                res.send(403);
                return;
            }
            if (/cas:authenticationSuccess/.exec(casBody)){
                if (/<cas:user>(.*)<\/cas:user>/.exec(casBody)) req.session.name = RegExp.$1;
                if (/<cas:proxyGrantingTicket>(.*)<\/cas:proxyGrantingTicket>/.exec(casBody)) {
                    var pgtIou = RegExp.$1;
                    req.sessionStore.get(pgtIou, function(pgt){
                        req.session.pgt = pgt;
                    });
                }

                req.session.st = ticket;

                // store another session id in the store if ssoff is intended
                if (req.ssoff){
                    req.sessionStore.set(ticket, {sid: req.session.id}, function(){
                        next();
                    })
                    return;
                }
            }
            next();
        });
    }
}
