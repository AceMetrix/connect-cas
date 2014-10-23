var origin = require('./util').origin;
var _ = require('lodash');
var parseUrl = require('url').parse;
var formatUrl = require('url').format;
var request = require('request');
var xml2js = require('xml2js').parseString;
var stripPrefix = require('xml2js/lib/processors').stripPrefix;

module.exports = function (overrides) {
    var configuration = require('./configure')();
    var options = _.extend({}, overrides, configuration);

    var pgtPathname = pgtPath(options);

    return function(req,res,next){
        if (!options.host && !options.hostname) throw new Error('no CAS host specified');
        if (options.pgtFn && !options.pgtUrl) throw new Error('pgtUrl must be specified for obtaining proxy tickets');

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

        if (options.pgtUrl || options.query.pgtUrl)
            options.query.pgtUrl = pgtPathname ? req.protocol + '://' + req.get('host') + pgtPathname : options.pgtUrl;

        if (pgtPathname && req.path === pgtPathname && req.method === 'GET') {
            if (!req.query.pgtIou || !req.query.pgtId) return res.send(200);

            req.sessionStore.set(req.query.pgtIou, _.extend(req.session, {pgtId: req.query.pgtId}));
            return res.send(200);
        }

        if (!ticket){
            next();
            return;
        }

        if (req.sessionStore) {
            // Have I already validated this ticket?
            req.sessionStore.get(req.session.id, function (err, storedSession) {
                if (storedSession && storedSession.st && (storedSession.st === ticket)) {
                    return next();
                } else {
                    request.get(formatUrl(options), function(casErr, casRes, casBody){
                        if (casErr || casRes.statusCode !== 200){
                            res.send(403);
                            return;
                        }

                        validateCasResponse(req, res, ticket, casBody, options, next);
                    });
                }

            });
        } else {
            return next();
        }

    };
};

function validateCasResponse(req, res, ticket, casBody, options, next) {
    xml2js(casBody, {explicitRoot: false, tagNameProcessors: [stripPrefix]}, function(err, serviceResponse) {
        if (err) {
            console.error('Failed to parse CAS server response. (' + err.message + ')');
            res.send(500);
            return;
        }

        var success = serviceResponse && serviceResponse.authenticationSuccess && serviceResponse.authenticationSuccess[0],
            user = success && success.user && success.user[0],
            pgtIou = success && success.proxyGrantingTicket && success.proxyGrantingTicket[0];

        if (!serviceResponse) {
            console.error('Invalid CAS server response.');
            res.send(500);
            return;
        }

        if (!success) {
            next();
            return;
        }
        req.session.st = ticket;

        if (req.ssoff) {
            req.sessionStore.set(ticket, {sid: req.session.id});
        }

        req.session.cas = {};
        for (var casProperty in success){
            req.session.cas[casProperty] = success[casProperty][0];
        }

        if (!pgtIou) {
            next();
            return;
        }

        if (options.pgtFn) {
            options.pgtFn.call(null, pgtIou, function(err, pgt){
                if (err) return res.send(502);
                req.session.pgt = pgt;
                next();
            });
            return;
        }
        retrievePGTFromPGTIOU(req, pgtIou, next);
    });
}

function retrievePGTFromPGTIOU(req, pgtIou, cb) {
    req.sessionStore.get(pgtIou, function(err, session){
        req.session.pgt = session.pgtId;
        cb();
    });
}
// returns false or the relative pathname to handle
function pgtPath(options){
    var pgtUrl = parseUrl(options.pgtUrl || (options.query ?  options.query.pgtUrl : ''));
    if (pgtUrl.protocol === 'http:') throw new Error('callback must be secured with https');
    if (pgtUrl.protocol && pgtUrl.host && options.pgtFn) return false;
    return pgtUrl.pathname;
}
