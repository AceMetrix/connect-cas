var _ = require('underscore');
var request = require('request');

module.exports = function(options){

    var configuration = require('./configure')();

    options = _.extend({}, configuration, options);
    return function(req,res,next){
        if (req.method !== 'POST') {
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

            req.sessionStore.destroy(st, function(err){
                if (err) console.error(err);

                res.writeHead(204);
                res.end();
            });
        });
    }
}
