# CAS Validate

This is a utility to facilitate validating a service with a CAS
server.  It allows single sign on and single sign out, redirecting to
the CAS server if a CAS login has not yet been established.

The whole reason I am pushing this up to github is that I didn't
notice that any other implementations handle the POST message from the
CAS server which accomplishes "single sign out".


# Example use for a Connect-based server:

In your web service:

```javascript

var cas_validate = require('cas_validate');
...

var server = connect.createServer(
    ,connect.bodyParser()
    ,connect.cookieParser()
    ,connect.session({ store: new RedisStore
                       , secret: 'superSekrit' })
    ,connect.router(publicStuff)
    ,cas_validate.validate({'cas_host' : 'cas.ctmlabs.net'})
    ,connect.router(privateStuff)
);
```

Note that I am lame, and the 'cas_host' option should not have the
`http://` part.  Just the address.

In my installation, I sometimes find I have to float stuff outside of
the CAS onion layer, perhaps because I want to demo something to a
customer who doesn't have a CAS login, or because I don't want to be
bothered with logging in to CAS to test html layouts or CSS rules.
This works fine.  Just put those things above the cas_validate rule,
and it should work.

# Installation

Do something like:

```bash
$ cd ~/my/github/repos
$ git clone git://github.com/jmarca/cas_validate.git
$ cd myapplication
$ npm install ~/my/github/repos/cas_validate
```

(One of these days I will publish to npm, but not yet.  I have to
figure out how to test this first!)

# Tests

No tests at the moment.

Just set up a test server and see if it works for you.
Which is lame, I know.  It works for me, though.


# See Also

The CAS server is documented at <http://www.jasig.org/cas>.

# My original use-case:  JSONP access from another website

The scenario that I origially wrote this module for was as follows.
We had set up a CAS server, and had a website that used this server.
But I wanted to request some GeoJSON tiles from my node.js server from
that web page.  Rather than just allowing all comers to access my
JSONP service, I wanted to hide behind the CAS login as well.

To initialize under this use case, the web page has to request that
the CAS server authenticate the user and this service.  To do that,
send a request to the CAS server as follows.  Supposing that the CAS
server is located at `https://cas.server.net/cas` and the service in
question is `http://safe.server.net/jsonp`, you would send a request
as follows to the CAS server:

    https://cas.server.net/cas/login?service=http://safe.server.net/jsonp

The CAS server will then either force the user to log in properly, or
else send the request along to the `URL` passed in the `service` query
parameter.

The service will get a one-time use ticket from the CAS server.  This
library is set up to consume that ticket, contact the CAS server to
make sure that the ticket is valid, and then set up a session for the
user using a valid session cookie from the original web service.
(This last part is a bit hacky, you'll probably have to edit the code
to get it to work for you).

From then on, all requests to this service that pass through this
library are checked against the established list of sessions.  Because
our CAS server lets sessions remain valid for up to 8 hours of
inactivity, I'm using a Redis-based session cache that lasts for a
longer time.  If a session has timed out, then this middleware layer
will respond to the request with an error message (which it is assumed
will be passed to the client as a JSON object) saying that the client
should reinitialize.  Client side javascript can automate this
reinitialization process, or else you can just force the user to
refresh the browser page.

The final piece of the puzzle is that when the user logs out of the
CAS server, the server sends a logout request to all services that
have requested login validation.  The one-time ticket is again used to
flag the session.  The `POST` handler expects that the body has been
decoded, runs a REGEX over the body and extracts the service ticket,
and then invalidates the session with this key.

The JSONP example use case is pretty complicated, but is why I
originally put this together.  That and I couldn't find a CAS client
when I wrote it.  Of course, this CAS client also works for regular
access to resources.

