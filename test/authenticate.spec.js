describe('#authenticate', function(){
    var server;
    before(function(done){
        server = serverSetup(done);
    });
    after(function(done){
        server.close(done);
    });
});
var serverSetup = function(done){
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
    .use(cas.authenticate())
    .use(function(req, res, next){
        res.end('hello world');
    });
    var server = http.createServer(app).listen(3000, done);
    server.setTimeout(20);
    return server;
};
