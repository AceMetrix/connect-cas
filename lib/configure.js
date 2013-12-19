var _ = require('underscore');
var defaults = { 
    protocol: 'https',
    host: undefined,
    hostname: undefined, // ex. google
    port: 443,
    gateway: false, // set to true only if you wish to do authentication instead of authorization
    paths: {
        validate: '/cas/validate',               // not implemented
        serviceValidate: '/cas/serviceValidate', // CAS 2.0
        proxyValidate: '/cas/proxyValidate',     // not implemented
        proxy: '/cas/proxy',                     // not implemented
        login: '/cas/login',
        logout: '/cas/logout'
    }   
}

module.exports = function(options){
    if (!options) return defaults;

    return _.extend(defaults, options);
}
