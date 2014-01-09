var formatUrl = require('url').format;
var configuration = require('./configure');
var request = require('request');
var _ = require('lodash');
var q = require('q');

module.exports = function(options, cb){
    options = _.extend({}, options, configuration());

    if (!options.targetService) throw new Error('no target proxy service specified');
    if (!options.pgt) throw new Error('no proxy granting ticket specified');

    options.pathname = options.paths.proxy;
    options.query = options.query || {};
    options.query.targetService = options.targetService;
    options.query.pgt = options.pgt;

    var d = q.defer();

    request.get(formatUrl(options), function(err, res, body){
        if (err || res.statusCode !== 200) {
            if (cb) cb(err);
            d.reject(err);
            return;
        }
        if (/<cas:proxySuccess/.exec(body)) {
            if (/<cas:proxyTicket>(.*)<\/cas:proxyTicket>/.exec(body)){
                if (cb) cb(null, RegExp.$1);
                d.resolve(RegExp.$1);
                return;
            }
        }
        err = new Error('proxying failed, the pgt may be invalid');
        if (cb) cb(err);
        d.reject(err);
    });
    return d.promise;
};
