# CAS Validate

This is a utility to facilitate validating a web service based on
Connect or Express (and perhaps other frameworks or nothing at all)
with a CAS server(<http://www.jasig.org/cas>.  It allows single sign
on and
[single sign out](https://wiki.jasig.org/display/CASUM/Single+Sign+Out).
In other words, if a client has previously logged in to the CAS
server, this library will allow your service to transparently detect
that fact, and if the user subsequently logs off from the CAS server,
this library can handle the subsequent POST message from the CAS
server and log the user out of your service as well.

The need to support single sign out was the original reason I wrote
this library.  Since then I modularized it so that I could apply
different strategies to different services in my Connect and Express
applications.  The original development was conducted when Connect
still had routing capabilities, but all but one feature still works
with the latest Connect, and all features work with Express.



# Example use for a Connect-based server:

Using the library is pretty easy.  Just add the necessary `require`
statement, and then slot in the desired CAS behavior.  For example to
prevent all access to your application, you would do the following:

```javascript

var cas_validate = require('cas_validate');
...

var app = connect()
            .use(connect.cookieParser('barley wheat napoleon'))
            .use(connect.session({ store: new RedisStore }))
            .use(cas_validate.redirect({host:'my.cas.host.net'})
            .use(function(req, res, next){
                      res.end('hello world')
                 });
var server = app.listen(3000,function(e){
            if(e) throw new Error(e)
            console.log('app started on port 3000')
    });
);
```

A few thing to note.  First I am using the connect-redis plugin to
manage sessions from CAS.  I haven't tested whether other session
management plugins will work, but as long as they allow simple
operations such as

    req.session.st = ticket

they should work fine.

Second, the `host` option currently just wants the host.  I prepend
`https://` to this host.  If you aren't using https for your CAS
server, then you're out of luck for using this library.


# Installation

## Via npm

```bash
$ cd myapplication
$ npm install cas_validate
```

Or you can add it to your package.json dependencies.


## Manual install

```bash
$ cd ~/my/github/repos
$ git clone git://github.com/jmarca/cas_validate.git
$ cd myapplication
$ npm install ~/my/github/repos/cas_validate
```



# Exported Functions

## `configure (options)`

Override the default options.  These are also the list of options you can pass to each exported function.  Here's the list of defaults:

```javascript
var defaults = { 
    host: undefined, // cas host
    client: undefined, // service client
    gateway: undefined,
    uris: {
        validate: '/cas/validate',               // not implemented
        serviceValidate: '/cas/serviceValidate', // CAS 2.0
        proxyValidate: '/cas/proxyValidate',     // not implemented
        proxy: '/cas/proxy',                     // not implemented
        login: '/cas/login',
        logout: '/cas/logout'
    }   
}
```


## `ticket (options)`

The `ticket` function is crucial to handling CAS sessions.  It will
consume the service ticket from the CAS server, verify that it is
valid, establish a valid session on your service for the client, and
will store the CAS credentials in a redis database to allow for single
sign out POST messages.  If there is no service ticket in the request,
or if the service ticket is not valid, this function will simply pass
control along to the next connect middleware in the web stack.

## `check_or_redirect (options)`

The `check_or_redirect` function is probably the most useful one.
Used in conjunction with the `ticket` function, it will enable
CAS-based authentication.

### Example

An example of redirecting the request to another destination is shown
below, modified from the test suite.


```javascript
cas_validate.configure({host:chost, client: 'http://' + testhost + ':' + testport + '/'})
app = connect()
app.use(cas_validate.ssoff())
app.use(cas_validate.ticket())
app.use(function(req, res, next){
            if(req.session.st){
                return res.end('hello '+req.session.name)
            }else{
                return res.end('hello world (not logged in)')
            }
        }
       )
var login = connect()
login.use(connect.cookieParser('six foot barley at Waterloo'))
login.use(connect.session({ store: new RedisStore }))
login.use('/login',cas_validate.check_or_redirect())
login.use('/',app)

server = login.listen(testport,done)

```

In the above example, the `/login` route will send the user to the CAS
server to login, and then return them to the `/` destination.  The
default behavior would be to return them to the `/login` path that
they came from.

Also note that since we don't expect the CAS server to send its ticket
to the `/login` path, the `ticket` service is not attached to that
route.  It is attached to the `/` route, and will consume the ticket
there.

Also also, when the CAS session expires and the CAS server sends a
post request informing your server of this fact, it will send it to
the path listed in the `service` parameter.  So if you only want to
allow POST requests to a certain address, that is another reason to
specify the service parameter.

## `check_and_return (options)`

The `check_and_return` function is somewhat useful.  The idea is to
exploit the feature in the CAS server that listens for a
'gateway=true' parameter in the URL.  This will return a service
ticket if the client has a valid CAS session, and will return nothing
if not.

### Example

The previous example has been modified below to use check_and_return
instead of check_or_redirect

```javascript
cas_validate.configure({host:chost, client: 'http://' + testhost + ':' + testport + '/'})
app = connect()
app.use(cas_validate.ssoff())
app.use(cas_validate.ticket())
app.use(cas_validate.check_and_return())
app.use(function(req, res, next){
            if(req.session.st){
                return res.end('hello '+req.session.name)
            }else{
                return res.end('hello world (not logged in)')
            }
        }
       )
var login = connect()
login.use(connect.cookieParser('six foot barley at Waterloo'))
login.use(connect.session({ store: new RedisStore }))
login.use('/login',cas_validate.check_or_redirect())
login.use('/',app)

server = login.listen(testport,done)


```

In the previous server, the system would not know whether or not a
user was logged in until the user went to the `/login` route and
triggered the `check_or_redirect` function.  Here, instead, the `/`
route has the `check_and_return` function set.  What happens is that
the first time the user goes to the `/` location, the CAS system is
checked to see if the user is logged in already.  Internally this sets
a flag in the session, so as to prevent an infinite loop.  If the user
is logged in already, then the CAS system will respond with a valid
service ticket that the `ticket` service will consume.  If the client
has not established a CAS login, then there is no ticket sent from
CAS, and the user is not logged in.

The problem with this approach is that it does not detect if the user
goes to your web application, then logs in to another CAS service.
Once the gateway service is checked, it is not checked again.

If you wish to check the CAS service once with every request, then
simply delete the session property `req.session.gateway`.  However, be
aware that until the user logs in properly, resetting
`req.session.gateway` will cause a redirect through the CAS server
with every request, which will greatly slow down the performance of
your system.


## `redirect (options)`

`redirect` is a somewhat lame filter, but it can be useful.  All it
does is redirect incoming queries to the CAS login page.  Even if the
session has been established, it will always ignore that fact and
bounce the request.

## `ssoff (options)`

The `ssoff` service will listen for incoming POST messages from the
CAS server and will delete sessions as appropriate.

Do *not* put this service after the `check_or_redirect` service, or the
CAS server POSTs will get redirected to the CAS server to log in!

### Example

```javascript

app.use(cas_validate.ssoff())
app.use(cas_validate.ticket())
app.use(cas_validate.check_or_redirect())
app.use('/',function(req, res, next){
          res.end('hello only to the authenticated world')
});

```

## `logout`

The `logout` service is similar to single sign off, but does the job
of invalidating the current session first, before triggering the CAS
server's logout function.

You can use this with the `ssoff` service to enable logging out from
your application directly, or indirectly from some other CAS enabled
app.

### Example

As usual, check out the test for a complete example.  Cut and paste below:

```javascript

cas_validate.configure({host:'my.cas.host', client: 'http://' + testhost + ':' + testport + '/'})
app = connect()
    .use(connect.bodyParser())
      .use(connect.cookieParser('barley Waterloo Napoleon loser'))
      .use(connect.session({ store: new RedisStore }))

app.use('/username',cas_validate.username)

app.use('/quit',cas_validate.logout())
app.use(cas_validate.ssoff())
app.use(cas_validate.ticket({host:'my.cas.host'}))
app.use(cas_validate.check_and_return())

app.use(function(req, res, next){
            if(req.session.st){
                return res.end('hello '+req.session.name)
            }else{
                return res.end('hello world (not logged in)')
            }
        }
       )
var login = connect()
.use(connect.cookieParser('six foot barley at Waterloo'))
.use(connect.session({ store: new RedisStore }))
login.use('/login',cas_validate.check_or_redirect())
login.use('/',app)
server=login.listen(testport
                   ,done)

```

## `session_or_abort (options)`

The `session_or_abort` service no longer works with Connect, as
routing has been removed.  This is the only feature that requires
Express.

The idea is to abort the current route if a session has not been
established.  This is done by calling `next('route')` within the code
if the CAS session check fails.

The intended use case is to assign certain stacks of routes to logged
in users, and others to those who are not logged in, without having to
resort to multiple paths or lots of `if` statements in your server
code.


### Example

```javascript

app = express()
      .use(connect.cookieParser('barley Waterloo Napoleon Mareschal Foch bravest'))
      .use(connect.session({ store: new RedisStore }))

app.get('/secrets'
       ,cas_validate.session_or_abort()
       ,function(req,res,next){
            res.end('super secret secrets')
        })

app.get('/secrets'
       ,function(req,res,next){
            res.end('public secrets')
        })

```


# Tests

The tests provide working examples of how to use the library.

To run the tests, you need to have a working CAS server, and you need
to set lots of environment variables.

## Environment variables

* CAS_HOST:  no default.  The CAS host (bare host name or number; not
  https, not /cas/login)

* CAS_USER:  no default.  Your CAS username you want to use for the
  tests.

* CAS_PASS: no default.  The password to go along with the CAS
  username

* CAS_VALIDATE_TEST_URL: Default is '127.0.0.1'.  If you want to test
  single sign out (the `ssoff` service), then you'll need to run your
  test server on a public machine, with a URL that the CAS server can
  send a POST to.  SSOFF tests will be skipped if CAS_VALIDATE_TEST_URL
  is 127.0.0.1 and the hostname part of CAS_HOST is *not* 127.0.0.1.

* CAS_VALIDATE_TEST_PORT: Default is 3000.  If you are already using
  port 3000 for something else, change this.  Also, make sure that
  this port is not blocked in your firewall if you want to test single
  sign off...otherwise you won't see the POSTs from the CAS server to
  your test application.

To run the tests, make sure to first install all of the dependencies
with

    npm install

Then run the tests with

    npm test

or

    make test

(I do this to get the nyan cat reporter)

If you are running on localhost, the last tests related to single sign
off will be skipped.  The idea is that localhost isn't usually an
address that can be hit by another machine, so the test should not be
run.

Instead, put the library on a machine with a URL (even a numeric one)
that your CAS server can see and send a POST to.  This will more
accurately model a real production environment.

For example, if you have a server called `http://awesome.mycompany.net`
you can run the test on port 3000 on this machine by typing

```
export CAS_VALIDATE_TEST_URL='awesome.mycompany.net'
```

Then all the tests will run, and they should all pass.  Assuming of
course that you have a properly configured CAS server and identified
it as noted above.  The only caveat is that waiting for the POST is
slow, and so the test may timeout.  If this happens, try running with
a longer timeout period (`mocha --timeout 50000 test`)

# Logging

This package uses [winston](https://github.com/flatiron/winston).  Not
well, but anyway, there it is.  Basically, if you want lots of output,
set the `NODE_ENV` environment variable to 'development'.  If you are
running in production, set `NODE_ENV` to 'production'.  This also
meshes well with Express usage of the `NODE_ENV` variable.  Finally,
if something weird is going on in production, you can also set the log
level explicitly, by setting either `CAS_VALIDATE_LOG_LEVEL` or
`LOGLEVEL` to the usual ['debug','info','warn','error'] (although this 
hasn't been tested)

In the code noisy alerts are at the debug level, and then errors are 
at the error level, but maybe in the future I'll add finer grained 
message levels.


# See Also

The CAS server is documented at <http://www.jasig.org/cas>.
