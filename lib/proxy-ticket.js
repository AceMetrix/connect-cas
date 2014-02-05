var url = require('url');
var configuration = require('./configure');
var request = require('request');
var _ = require('lodash');
var q = require('q');
var authenticate = require('./authenticate');
var origin = require('./util').origin;

module.exports = function(options){
    options = _.extend({}, options, configuration());
    if (!options.targetService) throw new Error('no target proxy service specified');

    options.pathname = options.paths.proxy;
    options.query = options.query || {};
    options.query.targetService = options.targetService;

    return function(req, res, next){
        if (!req.session.pgt) return redirectToLogin(options, req, res);
        if (req.pt && req.pt[options.targetService]) return next();

        options.query.pgt = req.session.pgt;

        request.get(url.format(options), function(err, res, body){
            if (err || res.statusCode !== 200) return redirectToLogin(options, req, res);
            if (/<cas:proxySuccess/.exec(body)) {
                if (/<cas:proxyTicket>(.*)<\/cas:proxyTicket>/.exec(body)){
                    req.pt = req.pt || {};
                    req.pt[options.targetService] = RegExp.$1;
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
    res.redirect(307, url.format(options));
}
