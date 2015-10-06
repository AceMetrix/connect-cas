var _ = require('lodash');
var HttpStatus = require('http-status-codes');

module.exports = function(serviceUrl){
    return function(req,res,next){
        if (!req.sessionStore) throw new Error('no session store configured');
        if (!serviceUrl) throw new Error('no service url configured');

        req.ssoff = true;
        if (req.method !== 'POST' || req.url !== serviceUrl) {
            next();
            return;
        }
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
                if (result && result.sid) req.sessionStore.destroy(result.sid);
                req.sessionStore.destroy(st);
            });
            res.send(HttpStatus.NO_CONTENT);
        });
    }
};
