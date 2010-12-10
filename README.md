# CAS Validate

This is a utility to facilitate validating a service with a CAS
server.

The scenario that I am using this module for is when I have a CAS
server that provides validation, and then I have a `node.js` service
that provides some `JSONP` data to a web page that authenticates using
the CAS server.

To initialize using this application, the web page has to request that
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
inactivity, I've set the memory cache of the session to last for an
equivalent period of time.  If a session has timed out, then this
middleware layer will respond to the request with an error message
(which it is assumed will be passed to the client as a JSON object)
saying that the client should reinitialize.  Client side javascript
can automate this reinitialization process, or else you can just force
the user to refresh the browser page.

The final piece of the puzzle is that when the user logs out of the
CAS server, the server sends a logout request to all services that
have requested login validation.  The one-time ticket is again used to
flag the session.  The `POST` handler expects that the body has been
decoded, runs a REGEX over the body and extracts the service ticket,
and then invalidates the session with this key.

# Example use:


# Installation

    $ git clone git://github.com/jmarca/cas_validate.git
    $ cd cas_validate
    $ npm link .

# See Also

The CAS server is documented at (http://www.jasig.org/cas).
