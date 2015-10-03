var qs = require('querystring');
var url = require("url");
module.exports.origin = function(req){
    var query = req.query;
    if (query.ticket) delete query.ticket;
    var querystring = qs.stringify(query);
    return req.protocol + '://' + req.get('host') + url.parse(req.originalUrl).pathname + (querystring ? '?' + querystring : '');
};