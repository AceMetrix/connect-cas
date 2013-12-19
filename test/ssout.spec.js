xdescribe('#ssout', function(){
    var server;
    before(function(done){
        casServerSetup(function(){
            server = serverSetup('ssout', done); 
        });
    });
    after(function(done){
        server.close(done);
    });
    it('should log the user out when CAS sends POST', function(done){
        var request = http.request({host: 'localhost', port: 3000, method: 'POST'}, function(response){
            response.statusCode.should.equal(204);
            done();
        });
        request.write('<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="12345" Version="2.0" IssueInstant="[CURRENT DATE/TIME]"><saml:NameID>@NOT_USED@</saml:NameID><samlp:SessionIndex>12345</samlp:LogoutRequest>');
        request.end();
    });
    it('should allow normal POST to go through', function(done){
        var request = http.request({host: 'localhost', port: 3000, method: 'POST'}, function(response){
            response.statusCode.should.equal(200);
            done();
        });
        request.write('this is cool');
        request.end();
    });

});

var casServerSetup = function(done){
    var app = express()
    app.get('/cas/serviceValidate', function(req, res){
        var response = '';
        if (req.query.ticket === 'validTicket'){
            response = '<cas:serviceResponse xmlns:cas="http:/www.yale.edu/tp.cas"><cas:authenticationSuccess><cas:user>somebody@gmail.com</cas:user></cas:authenticationSuccess></cas:serviceResponse>';
        } else{
            response = '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationFailure code="INVALID_TICKET">Ticket ST-1856339-aA5Yuvrxzpv8Tau1cYQ7 not recognized</cas:authenticationFailure></cas:serviceResponse>';
        }
        res.end(response);
    });
    app.listen(1337, done);
    return
};
var serverSetup = function(methodName, done){
    var app = express()
    .use(connect.cookieParser())
    .use(connect.session({
        secret: 'ninja cat',
        key: 'sid'
    }))
    .use(function(req, res, next){
        lastRequest = req;
        next();
    })
    .use(cas[methodName]())
    .use(function(req, res, next){
        res.end('hello world');
    });
    var server = http.createServer(app).listen(3000, done);
    server.setTimeout(20);
    return server;
};
