// A simple Express app demonstrating CAS authentication.
// Login is required for the "/login" URL, but not for
// the home page. The home page is aware of logins and
// can display the username.
//
// Copy this to a folder of your own and be sure to run
// "npm install express" and "npm install connect-cas".

var express = require('express');
var cas = require('connect-cas');
var url = require('url');

// Your CAS server's hostname
cas.configure({ 'host': 'cas.YOURSCHOOLHERE.edu' });
console.log(cas.configure());
var app = express();

// Use cookie sessions for simplicity, you can use something else
app.use(express.cookieParser('this should be random and secure'));
app.use(express.cookieSession());

app.get('/', function(req, res) {
  if (req.session.cas && req.session.cas.user) {
    return res.send('<p>You are logged in. Your username is ' + req.session.cas.user + '. <a href="/logout">Log Out</a></p>');
  } else {
    return res.send('<p>You are not logged in. <a href="/login">Log in now.</a><p>');
  }
});

// This route has the serviceValidate middleware, which verifies
// that CAS authentication has taken place, and also the
// authenticate middleware, which requests it if it has not already
// taken place.

app.get('/login', cas.serviceValidate(), cas.authenticate(), function(req, res) {
  // Great, we logged in, now redirect back to the home page.
  return res.redirect('/');
});

app.get('/logout', function(req, res) {
  if (!req.session) {
    return res.redirect('/');
  }
  // Forget our own login session
  if (req.session.destroy) {
    req.session.destroy();
  } else {
    // Cookie-based sessions have no destroy()
    req.session = null;
  }
  // Send the user to the official campus-wide logout URL
  var options = cas.configure();
  options.pathname = options.paths.logout;
  return res.redirect(url.format(options));
});

app.listen(3000);

