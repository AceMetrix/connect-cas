var _ = require('lodash');
var request = require('request');

module.exports = function(options){

    var configuration = require('./configure')();

    options = _.extend({}, configuration, options);
    return function(req,res,next){
        if (!req.sessionStore){
            throw new Error('no session store configured');
        }

        if (req.method !== 'POST') {
            next();
            return;
        }

        req.ssoff = true;
        var body = '';
        req.on('data', function(chunk){
            body += chunk;
        });
        req.on('end', function(){
            if (!/<samlp:SessionIndex>(.*)<\/samlp:SessionIndex>/.exec(body)) {
                next();
                return;
            }
            var st = RegExp.$1;

            req.sessionStore.get(st, function(err, result){
                if (result.sid) req.sessionStore.destroy(result.sid);
                req.sessionStore.destroy(st);
            })
            res.send(204);
        });
    }
}
