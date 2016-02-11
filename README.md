[![Build Status](https://travis-ci.org/AceMetrix/connect-cas.svg)](https://travis-ci.org/AceMetrix/connect-cas)

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

## Complete Example

A more complete example of a simple Express app that uses CAS for login, displays the CAS username, and offers a logout link can be found in the `example` folder. You'll need to copy `example/app.js` to your own folder and install its dependencies:

    npm install express
    npm install connect-cas

Express is required only for the example app. It is not required for `connect-cas`.

## Proxy Tickets

To proxy services, you can configure the `serviceValidate` middleware like below:

```
connect()
  ...
  .use(cas.serviceValidate({pgtUrl: '/pgtCallback'}))
  .use(cas.proxyTicket({targetService: 'https://service-to-proxy/blah'});
  ...
```

The proxy granting ticket value will be available in `req.session.pgt` and a hash of proxy tickets are available in `req.pt`.  You may then append that proxy ticket manually to the services you wish to proxy.  To reuse the proxy tickets, see [#25](https://github.com/AceMetrix/connect-cas/issues/25).

You may also pass in an absolute url if you wish for the pgtCallback to be in a separate app.  If so, pass in an additional `pgtFn`:

```
connect()
.use(cas.serviceValidate({pgtUrl: 'https://some-server.com/pgtCallback', pgtFn:function(pgtIou, cb){
  // given the pgtIou, retrieve the pgtId however you can.  Then call ...
  cb(err, 'PGT-thepgtid');
}));
```

## Notes
- If you are behind an https proxy, be sure to set `X-Forwarded-Proto` headers. Connect-cas uses it to infer its own location for redirection.

## License

  MIT

[![NPM](https://nodei.co/npm/connect-cas.png)](https://nodei.co/npm/connect-cas/)