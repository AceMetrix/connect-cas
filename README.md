# Connect CAS

Connect cas is a connect-based middleware that allows you to authenticate through a CAS 2.0+ server.  It supports the gateway, renew, ssout, and proxy tickets.

Adapted from https://github.com/jmarca/cas_validate

## Installation

    npm install connect-cas
            
## Options

Many of these options are borrowed from node's [url documentation](http://nodejs.org/api/url.html).  You may set global options through the `.configure()` method or override them with any of the exposed middleware.

  - `procotol` The protocol to communicate with the CAS Server.  Defaults to 'https'.
  - `host` CAS server hostname
  - `port` CAS server port number.  Defaults to 443.
  - `gateway` Send all validation requests through the CAS gateway feature.  Defaults to false.
  - `paths`
    - `serviceValidate` Path to validate TGT
    - `proxyValidate` Path to validate PGT (not implemented)
    - `proxy` Path to obtain a proxy ticket
    - `login` Path to the CAS login
  
## Usage

```javascript
var cas = require('connect-cas');
var connect = require('connect');

connect()
  .use(connect.cookieParser('hello world'))
  .use(connect.cookieSession()) // or whatever session store
  .use(cas.serviceValidate())
  .use(cas.authenticate())
```
# License

  MIT
