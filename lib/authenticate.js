var origin = require('./util').origin;
var url = require('url');
var _ = require('lodash');

module.exports = function(overrides){
    var configuration = require('./configure')();
    var options = _.extend({}, overrides, configuration);
    return function(req, res, next){
        if (req.session && req.session.st){
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
        res.redirect(307, url.format(options));
    };
};
