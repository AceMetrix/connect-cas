var _ = require('lodash');
var authenticate = require('./authenticate');

module.exports = function(overrides){
    var configuration = require('./configure')();
    var options = _.extend({query: {gateway: true}}, configuration, overrides);
    return authenticate(options);
};
