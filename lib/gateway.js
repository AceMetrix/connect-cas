var origin = require('./util').origin;
var formatUrl = require('url').format;
var _ = require('lodash');
var qs = require('querystring');

module.exports = function(overrides){
    var configuration = require('./configure')();
    var options = _.extend({}, overrides, configuration);
    return function(req, res, next){
        if (req.session && (req.session.st || req.session.pgt)){
            next(); // do this instead of 303 redirect
            return;
        }
        res.redirect(307, formatUrl(options) + options.paths.login + '?' + qs.stringify({service: origin(req), gateway: true}));
    }
}
