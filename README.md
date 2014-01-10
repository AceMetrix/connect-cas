# Connect CAS

Connect cas is a connect-based middleware that allows you to authenticate through a CAS 2.0+ server.  It supports the gateway auth, single sign-out, and proxying other CAS clients.

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

## Proxy Tickets

To get a proxy granting ticket, you can configure the `serviceValidate` middleware like below:

```
connect()
  ...
  .use(cas.serviceValidate({pgtUrl: '/pgtCallback'}))
  ...
```

The proxy granting ticket value will be available in `req.session.pgt`

You may also pass in an absolute url if you wish for the pgtCallback to be in a separate app.  If so, pass in an additional `pgtFn`:

```
serviceValidate({pgtUrl: 'https://some-server.com/pgtCallback', pgtFn:function(cb){
  ...
  cb(err, 'PGT-thepgtid');
});
```
Then, use the provided `proxyTicket` method to get a proxy ticket:

```
cas.proxyTicket({targetService: 'https://service-to-proxy/blah', pgt: 'PGT-blah'}, function(err, proxyTicket){
    ...
});
```

# License

  MIT
