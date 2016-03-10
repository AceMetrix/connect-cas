var _ = require('lodash');
var defaults = {
    protocol: 'https',
    host: undefined,
    hostname: undefined, // ex. google
    port: 443,
    service: undefined,
    paths: {
        validate: '/cas/validate',               // not implemented
        serviceValidate: '/cas/serviceValidate', // CAS 2.0
        proxyValidate: '/cas/proxyValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout'
    }
};

module.exports = function(options){
    if (!options) return _.cloneDeep(defaults);

    return _.extend(defaults, options);
};
