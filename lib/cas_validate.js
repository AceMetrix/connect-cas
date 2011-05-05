var parseUrl = require('url').parse;
var http = require('http');
var request = require('request');
var querystring = require('querystring');
var redis = require("redis");

/**
 * CAS validate:  validate requests via CAS service tickets
 *
 * Options:
 *
 *   - `serivce`  the service url we are checking
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

var redclient = redis.createClient();

redclient.on("error", function (err) {
    console.log("Error " + err);
});

exports.validate = function validate(options){

    // have to validate cas service calls

    var cas_host = 'cas.ctmlabs.net';
    var validation_service = '/cas/serviceValidate';
    var login_service = '/cas/login';
    var options_service = options.service; //'http://safety.ctmlabs.net/geojson';

    return function validate(req,res,next){
        var url = parseUrl(req.url,true);
        var service = options_service ? options_service :
        'http://'+req.headers.host + url.pathname;
        var method = req.method.toLowerCase();
        console.log('HITTING VALIDATE: method: '+method);
        if (method == 'post'){
            invalidate(req,res,next);
            return;
        }
        if(url.query && url.query.ticket){
            // time to validate the service ticket
            var ticket = url.query.ticket;
            var cas_uri =  'https://'+cas_host+validation_service
            +'?'
            +querystring.stringify(
            {'service':service,
            'ticket':ticket});
            request({uri:cas_uri}, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    if(/cas:authenticationSuccess/.exec(body)){
                        console.log('auth passed ' + body);
                        // stuff the cookie  into a session
                        // and store the ticket as well

                        // valid user
                        if(/<cas:user>(\w+)<\/cas:user>/.exec(body)){
                            req.session.name = RegExp.$1;
                        }
                        req.session.st = ticket;

                        // my old hack modifying session keys no longer works.
                        redclient.set(ticket,req.sessionID);
                        res.writeHead(307,{'location':service});
                        res.end();
                    }
                }else{
                    console.log('auth failed with:'+body) ;
                    //next(new Error('must log in again?'));
                    res.writeHead(307, { 'location': 'https://'+cas_host+login_service
                                         +'?'
                                         +querystring.stringify(
                                             {'service':service})});
                    res.end();
                }

            });
            console.log('ticket was in the query');
            // no next if that was the case
        }else{
            // no ticket in the request.  check for still valid CAS session
            var st; // temporary service ticket holder
            if(st = req.session.st){
                return next();
            }else{
                // not okay.  must log in again
                console.log('ticket not in session store:'+JSON.stringify(req.session) + ' query:' + url.query) ;
                res.writeHead(307, { 'location': 'https://'+cas_host+login_service
                                     +'?'
                                     +querystring.stringify(
                                         {'service':service})});
                res.end();
            }

        }
        // https://cas.ctmlabs.net/cas/serviceValidate?service=http://safety.ctmlabs.net/geojson&ticket=ST-2-tpJilV9tKI1aDzsbNIRr-cas
    };

};

var invalidate = exports.invalidate = function invalidate(req,res,next){
    // handling a post here

    // parse out the ticket number from the body, then get the
    // sessionid associated with that ticket, and destroy it.
    for( var param in req.body){
        if(/<samlp:SessionIndex>(.*)<\/samlp:SessionIndex>/.exec(req.body[param])){
            var st = RegExp.$1;
            redclient.get(st,function(err,sid){
                if(!err){
                    req.sessionStore.get(sid,function(err,sess){
                        if(sess){
                            delete sess.st;
                            sess.destroy();
                            console.log('found session store '+sid+', killing it');
                        }
                    });
                    redclient.del(st);
                }
            });
            break;
        }
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end();
    return;

};

