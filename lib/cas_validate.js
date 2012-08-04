var parseUrl = require('url').parse;
var http = require('http');
var request = require('request');
var querystring = require('querystring');
var redis = require("redis");

var env = process.env;
var chost = process.env.CAS_HOST;
var _ = require('underscore');


/**
 * CAS validate:  validate requests via CAS service tickets
 *
 * Options:
 *
 *   - `serivce`  the service url we are checking.  probably best to leave it blank
 *   - `cas_host` the CAS host.  will fallback to environment variable CAS_HOST
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

var redclient = redis.createClient();

redclient.on("error", function (err) {
    console.log("Error " + err);
});

function username(req,res,next){
    res.setHeader('Content-Type','application/json');
    if(req.session !== undefined && req.session.name !== undefined){
        return res.end(JSON.stringify({'user':req.session.name}));
    }else{
        return res.end(JSON.stringify({'user':null}));
    }
}

// these should be settable options
var validation_service = '/cas/serviceValidate';
var login_service = '/cas/login';



function session_or_abort(){
    return function(req,res,next){
        if(req.session !== undefined  && req.session.st){
            //console.log('have session.  steady as she goes');
            // okay, pass control
            return next();
        }else{
            //console.log('no session, switch to next route');
            return next('route');//new Error('unauthorized'));
        }
    }
}

function check_or_redirect(options){
    // if no session, and no ticket in request, then redirect;
    // service param is optional, will default to whatever URL is used in the request

    var cas_host = options.cas_host ? options.cas_host : chost;
    if (! cas_host ) throw new Error('no CAS host specified');

    var opt_service = options.service; // for example: 'http://safety.ctmlabs.net/geojson';
    var gateway = options.gateway; // default to false

    return function(req,res,next){
        if(req.session !== undefined  && req.session.st){

            // okay, pass control
            //console.log('have session and session.st')

            return next();
        }

        // still here? redirect to CAS server
        var url = parseUrl(req.url,true);
        var service = opt_service ? opt_service :
            'http://'+req.headers.host + url.pathname;
        var queryopts = {'service':service};
        if(gateway){
            queryopts.gateway = gateway;
        }
        //console.log('no current session, redirecting to CAS server') ;
        // previous version had an if here, with a 403 if request was
        // a json, but that never worked anyway

        res.writeHead(307, { 'location': 'https://'+cas_host+login_service
                              +'?'
                              +querystring.stringify(queryopts)
                           });
        return res.end();
    }
}

function check_no_redirect(options){
    _.extend(options, {'gateway':true});
    return redirect(options);
}

function redirect(options){
    // if no session, and no ticket in request, then redirect;
    // service param is optional, will default to whatever URL is used in the request

    var cas_host = options.cas_host ? options.cas_host : chost;
    if (! cas_host ) throw new Error('no CAS host specified');

    var opt_service = options.service; // for example: 'http://safety.ctmlabs.net/geojson';
    var gateway = options.gateway; // default to false
    return function(req,res,next){
        //  redirect to CAS server
        var url = parseUrl(req.url,true);
        var service = opt_service ? opt_service :
            'http://'+req.headers.host + url.pathname;
        var queryopts = {'service':service};
        if(gateway){
            // prevent an infinite loop
            if(req.session.gateway !== undefined){
                //console.log('gateway already checked')
                return next()
            }
            //console.log('gateway check to be done')
            req.session.gateway = true
            queryopts.gateway = gateway;
        }
        // previous version had an if here, with a 403 if request was
        // a json, but that never worked anyway

        res.writeHead(307, { 'location': 'https://'+cas_host+login_service
                              +'?'
                              +querystring.stringify(queryopts)
                           });
        return res.end();
    }
}



function logout(options){
    var cas_host = options.cas_host ? options.cas_host : chost;
    if (! cas_host ) throw new Error('no CAS host specified');
    var opt_service = options.service; // for example: 'http://safety.ctmlabs.net/geojson';
    return function(req,res,next){
        // for logging out directly
        // I'd use async.parallel here, but no real need
        var logouturl = 'https://'+chost + '/cas/logout';
        var service = opt_service ? opt_service :
            'http://'+req.headers.host
        var cas_uri =  logouturl+'?'
                    +querystring.stringify({'service':service})
        req.session.destroy(function(err){
            if(err){
                console.log(err);
            }
        });
        res.writeHead(307, { 'location': cas_uri });
        res.end()
    }
}


function invalidate(req,res,next){
    // handling a post here

    // parse out the ticket number from the body, then get the
    // sessionid associated with that ticket, and destroy it.
    //console.log('handling ssoff')
    for( var param in req.body){
        if(/<samlp:SessionIndex>(.*)<\/samlp:SessionIndex>/.exec(req.body[param])){
            var st = RegExp.$1;
            redclient.get(st,function(err,sid){
                if(!err){
                    req.sessionStore.destroy(sid,function(err){
                        if(err){
                            console.log(err);
                        }
                    });
                    redclient.del(st);
                }
            });
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end();
            return null;
        }
    }
    next(new Error('Unauthorized'));
    return null;
};


function ssoff(){
    return function(req,res,next){
        //console.log('in ssoff')
        var method = req.method.toLowerCase();
        if (method == 'post'){
            return invalidate(req,res,next);
        }else{
            //console.log('not a post')
            next();
        }
        return null;
    }
}

function ticket(options){

    var cas_host = options.cas_host ? options.cas_host : chost;
    if (! cas_host ) throw new Error('no CAS host specified');
    var opt_service = options.service; // for example: 'http://safety.ctmlabs.net/geojson';

    return function(req,res,next){
        var url = parseUrl(req.url,true);

        if(url.query === undefined || url.query.ticket === undefined){
            //console.log('moving along, no ticket');
            return next();
        }
        //console.log('have ticket')
        // have a ticket, try to set up a CAS session
        var service = opt_service ? opt_service :
            'http://'+req.headers.host + url.pathname;

        // validate the service ticket
        var ticket = url.query.ticket;
        var cas_uri =  'https://'+cas_host+validation_service
                    +'?'
                    +querystring.stringify(
                        {'service':service,
                         'ticket':ticket});
        //console.log('firing: '+cas_uri)
        request({uri:cas_uri}, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                if(/cas:authenticationSuccess/.exec(body)){
                    //console.log('auth passed ');
                    // stuff the cookie  into a session
                    // and store the ticket as well

                    // valid user
                    if(/<cas:user>(\w+)<\/cas:user>/.exec(body)){
                        req.session.name = RegExp.$1;
                    }
                    req.session.st = ticket;

                    // stuff into a redis session
                    redclient.set(ticket,req.sessionID);
                    next();
                    //res.writeHead(307,{'location':service});
                    //res.end();
                }else{
                    console.log('something else!' + body)
                    next('route')
                }

            }else{
                console.log('auth failed') ;
                // okay, not logged in, but don't get worked up about it
                next(new Error('authentication failed'));
            }
            return null;

        });
        return null
    }
}

exports.redirect = redirect;
exports.check_or_redirect = check_or_redirect;
exports.check_and_return = check_no_redirect;
exports.ticket = ticket;
exports.ssoff = ssoff;
exports.logout = logout;
exports.username = username;
exports.session_or_abort = session_or_abort;
