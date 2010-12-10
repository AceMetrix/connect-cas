var  parseUrl = require('url').parse;
// var  formatUrl = require('url').format;
var  sys = require('sys');
var fs = require('fs');
var http = require('http');
var crypto = require('crypto');
var querystring = require('querystring');
var request = require('request');

/**
 * CAS blocker:  block requests with invalid CAS tickets
 *
 * Options:
 *
 *   - `serivce`  the service url we are checking
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

exports.validate = function validate(options){

    // have to validate cas service calls
    // cas server url

    var cas_host = 'cas.ctmlabs.net';
    var validation_service = '/cas/serviceValidate';
    var service = options.service; //'http://safety.ctmlabs.net/geojson';

    var privateKey = fs.readFileSync('../ctmlabs.net.key').toString();
    var certificate = fs.readFileSync('../ctmlabs.net.crt').toString();
    var credentials = crypto.createCredentials({key: privateKey, cert: certificate});

    return function validate(req,res,next){
        var url = parseUrl(req.url,true);
        if(!url.query || !url.query.ticket){
            //next(new Error('no ticket, no ride'));
            next();
            return;
        }


        var cas_uri =  'https://'+cas_host+validation_service
            +'?'
            +querystring.stringify(
                {'service':service,
                 'ticket':url.query.ticket});


        request({uri:cas_uri}, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                if(/cas:authenticationSuccess/.exec(body)){
                    console.log('auth passed ' + body);
                }else{
                    console.log('auth failed with:'+body) ;
                    //next(new Error('must log in again?'));

                }
            }
            next();
        });
            // https://cas.ctmlabs.net/cas/serviceValidate?service=http://safety.ctmlabs.net/geojson&ticket=ST-2-tpJilV9tKI1aDzsbNIRr-cas
    };
};
