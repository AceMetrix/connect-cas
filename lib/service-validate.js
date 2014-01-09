var origin = require('./util').origin;
var _ = require('lodash');
var parseUrl = require('url').parse;
var formatUrl = require('url').format;
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

        options.query = options.query || {};
        options.query.service = origin(req);
        options.query.ticket = ticket;
        options.pathname = options.paths.serviceValidate;

        if (options.pgtUrl || options.query.pgtUrl) {
            options.query.pgtUrl = options.pgtUrl || options.query.pgtUrl;
            // handle pgt callback
            if (req.method === 'GET' && req.path === parseUrl(options.query.pgtUrl).pathname){
                if (req.query.pgtIou && req.query.pgtId){
                    req.sessionStore.set(req.query.pgtIou, _.extend(req.session, {pgtId: req.query.pgtId}));
                }

                res.send(200);
                return;
            }
        }

        if (!ticket){
            next();
            return;
        }

        request.get(formatUrl(options), function(casErr, casRes, casBody){
            if (casErr || casRes.statusCode !== 200){
                console.error(casErr);
                res.send(403);
                return;
            }
            if (!/cas:authenticationSuccess/.exec(casBody)) {
                next();
                return;
            }
            req.session.st = ticket;
            if (req.ssoff) req.sessionStore.set(ticket, {sid: req.session.id});

            if (/<cas:user>(.*)<\/cas:user>/.exec(casBody)) req.session.name = RegExp.$1;
            if (!/<cas:proxyGrantingTicket>(.*)<\/cas:proxyGrantingTicket>/.exec(casBody)) {
                next();
                return;
            }
            var pgtIou = RegExp.$1;
            retrievePGTFromPGTIOU(req, pgtIou, next);
        });
    };
};
function retrievePGTFromPGTIOU (req, pgtIou, cb){
    req.sessionStore.get(pgtIou, function(err, session){
        req.session.pgt = session.pgtId;
        cb();
    });
}
