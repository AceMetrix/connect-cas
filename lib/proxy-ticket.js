var url = require('url');
var configuration = require('./configure');
var request = require('request');
var _ = require('lodash');
var HttpStatus = require('http-status-codes');
var q = require('q');
var authenticate = require('./authenticate');
var origin = require('./util').origin;

module.exports = function(options){
    options = _.extend({}, configuration(), options);
    if (!options.targetService) throw new Error('no target proxy service specified');

    options.query = options.query || {};
    options.query.targetService = options.targetService;

    return function(req, res, next){
        if (!req.session.pgt) return redirectToLogin(options, req, res);
        if (req.session.pt && req.session.pt[options.targetService]) return next();

        options.query.pgt = req.session.pgt;
        options.pathname = options.paths.proxy;
        
        request.get(url.format(options), function(err, res, body){
            if (err || res.statusCode !== HttpStatus.OK) return redirectToLogin(options, req, res);
            if (/<cas:proxySuccess/.exec(body)) {
                if (/<cas:proxyTicket>(.*)<\/cas:proxyTicket>/.exec(body)){
                    req.pt = req.pt || {};
                    req.pt[options.targetService] = RegExp.$1;
                    req.session.pt = req.session.pt || {};
                    req.session.pt[options.targetService] = RegExp.$1;
                }
            }
            next();
        });
    };
};
function redirectToLogin(options, req, res){
    options.pathname = options.paths.login;
    options.query = {};
    options.query.service = origin(req);
    res.redirect(HttpStatus.TEMPORARY_REDIRECT, url.format(options));
}
