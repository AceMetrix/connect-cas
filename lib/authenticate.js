var origin = require('./util').origin;
var formatUrl = require('url').format;
var _ = require('lodash');
var qs = require('querystring');

module.exports = function(overrides){
    var configuration = require('./configure')();
    var options = _.extend({}, overrides, configuration);
    return function(req, res, next){
        if (req.session && (req.session.st || req.session.pgt)){
            // refresh the expiration if ssout
            if (req.ssout) {
                req.sessionStore.set(req.session.st, req.session.id);
            }
            next();
            return;
        }
        options.pathname = options.paths.login;
        options.query = options.query || {};
        options.query.service = origin(req);
        res.redirect(307, formatUrl(options));
    }
}
