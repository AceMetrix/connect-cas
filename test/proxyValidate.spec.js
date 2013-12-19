describe('#proxyValidate', function(){
    var server;
    before(function(done){
        casServerSetup(function(){
            server = serverSetup('proxyValidate', done); 
        });
    });
    after(function(done){
        server.close(done);
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
