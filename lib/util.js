var parseUrl = require('url').parse;
var formatUrl = require('url').format; 
var qs = require('querystring');

module.exports.origin = function(req){
    var query = req.query;
    if (query.ticket) delete query.ticket;
    var querystring = qs.stringify(query);
    return req.protocol + '://' + req.get('host') + req.path + (querystring ? '?' + querystring : ''); 
}
