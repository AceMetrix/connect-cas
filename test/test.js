var should = require('should')
var parseUrl = require('url').parse;
var http = require('http');
var request = require('request');
var querystring = require('querystring');
var async = require('async')
var express = require('express')
var connect = require('connect')

var cas = require('../lib/cas_validate')
var options = {
    protocol: 'http',
    host: 'localhost',
    port: 1337 
}
cas.configure(options);

// create a fake CAS server
var casServerSetup = function(done){
    var app = express()
    app.get('/cas/serviceValidate', function(req, res){
        var response = '';
        if (req.query.ticket === 'validTicket'){
            response = '<cas:serviceResponse xmlns:cas="http:/www.yale.edu/tp.cas"><cas:authenticationSuccess><cas:user>username</cas:user></cas:authenticationSuccess></cas:serviceResponse>';
        } else{
            response = '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationFailure code="INVALID_TICKET">Ticket ST-1856339-aA5Yuvrxzpv8Tau1cYQ7 not recognized</cas:authenticationFailure></cas:serviceResponse>';
        }
        res.end(response);
    });
    app.listen(1337, done);
    return
};

var serverSetup = function(methodName, done){
    var app = connect()
    .use(connect.cookieParser('barley wheat napoleon'))
    .use(connect.cookieSession({secret: 'asdf'}))
    .use(cas[methodName]())
    .use(function(req, res, next){
        res.end('hello world')
    });
    var server = http.createServer(app).listen(3000, done);
    server.setTimeout(1500);
    return server;
};

describe.only('cas_validate',function(){
    var casServer;
    var server;

    before(function(done){
        casServer = casServerSetup(done);
    });
    xdescribe('#configure', function(){});
    describe('#redirect', function(){
        before(function(done){
            server = serverSetup('redirect', done);
        });
        after(function(done){
            server.close(done)
        })
        it('should redirect when no session is established',function(done){
            http.get('http://localhost:3000/', function(response){
                response.statusCode.should.equal(307);
                response.headers.location.should.equal('http://' + options.host + ':1337/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2F')
                done();
            })
        })
        it('should redirect when session is established',function(done){
            http.get('http://localhost:3000/', function(response){
                var cookie = response.headers['set-cookie'];
                http.get({host: 'localhost', port: 3000, headers: {cookie: cookie}}, function(response){
                    response.statusCode.should.equal(307);
                    response.headers.location.should.equal('http://' + options.host + ':1337/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2F')
                    done();
                });
            })
        })
    });
    describe('#ticket', function(){
        before(function(done){
            server = serverSetup('ticket', done);
        });
        after(function(done){
            server.close(done)
        });
        it('should pass next if no ticket was issued', function(done){
            http.get('http://localhost:3000/', function(response){
                response.statusCode.should.equal(200);
                done();
            });
        })
        it('should redirect to login when ticket invalid', function(done){
            http.get('http://localhost:3000/?ticket=invalidTicket', function(response){
                response.statusCode.should.equal(307);
                response.headers.location.should.equal('http://localhost:1337/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2F');
                done();
            });
        });
        it('should redirect to original url when ticket is valid', function(done){
            http.get('http://localhost:3000/somePath?ticket=validTicket', function(response){
                response.statusCode.should.equal(307);
                response.headers.location.should.equal('http://localhost:1337/somePath?');
                done();
            });
        });
    });
});
xdescribe('POST to endpoint, save the post', function(){});
xdescribe('CAS session expired, but ticket was sent due to refresh', function(){
});
/*
describe('cas_validate.check_and_return',function(){

    var app
    var server
    before(
        function(done){
            app = connect()
        .use(connect.cookieParser('barley Waterloo Napoleon'))
        .use(connect.session({ store: new RedisStore }))
        app.use(cas.ticket({'cas_host':chost}))
        app.use('/valid'
            ,function(req, res, next){
                if(req.session && req.session.st){
                    return res.end('cas single sign on established in /valid path')
                }else{
                    return res.end('hello world from /valid path, no session')
                }

            });
    app.use(cas.check_and_return({'cas_host':chost
        ,'service':'http://'+ testhost +':'+testport+'/valid'}))
        app.use('/'
            ,function(req, res, next){
                // should never get here
                if(req.session && req.session.st){
                    return res.end('error choke and die');
                }else{
                    return res.end('hello world choke and die')
                }
            });
    server=app.listen(testport,done)

        })

after(function(done){
    server.close(done)
})

it('should return without asking for login when no session is established',function(done){

    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){

        rq({url:'http://'+ testhost +':'+testport+'/'
            ,followRedirect:true}
            ,function(e,r,b){
                r.statusCode.should.equal(200)
            should.exist(b)
            b.should.equal('hello world from /valid path, no session')
            cb()
            }
          )
    }]
    ,done
    )

})

it('should not redirect when a session is established',function(done){

    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){

        // set up a session with CAS server
        cas_login_function(rq
            ,function(e){
                return cb(e,rq)
            })
    }
    ,function(rq,cb){
        rq({url:'http://'+ testhost +':'+testport+'/'}
            ,function(e,r,b){
                r.statusCode.should.equal(200)
            should.exist(b)
            b.should.equal('cas single sign on established in /valid path')
            cb()
            }
          )

    }]
    ,done
        )


})

})

describe('cas_validate.check_or_redirect and cas_validate.ticket',function(){
    var app,server;

    before(
        function(done){
            app = connect()
        .use(connect.cookieParser('barley Waterloo Napoleon'))
        .use(connect.session({ store: new RedisStore }))
        .use(cas.ticket({'cas_host':chost}))
        .use(cas.check_or_redirect({'cas_host':chost})
            )
        .use(function(req, res, next){
            res.end('hello world')
        });
    server =app.listen(testport
        ,done)
        })
    after(function(done){
        server.close(done)
    })

    it('should redirect when no session is established',function(done){
        async.waterfall([function(cb){
            _setup_request(cb)
        }
        ,function(rq,cb){

            rq({url:'http://'+ testhost +':'+testport+'/'
                ,followRedirect:false}
                ,function(e,r,b){
                    r.statusCode.should.equal(307)
                r.headers.location.should.equal(casurl+'?service=http%3A%2F%2F'+ testhost +'%3A'+testport+'%2F')
                should.not.exist(b)
                cb()
                }
              )
        }]
        ,done
        )


    })

    it('should not redirect when a session is established',function(done){

        async.waterfall([function(cb){
            _setup_request(cb)
        }
        ,function(rq,cb){

            // set up a session with CAS server
            cas_login_function(rq
                ,function(e){
                    return cb(e,rq)
                })
        }
        ,function(rq,cb){
            rq({url:'http://'+ testhost +':'+testport+'/'}
                ,function(e,r,b){
                    r.statusCode.should.equal(200)
                should.exist(b)
                b.should.equal('hello world')
                cb()
                }
              )

        }]
        ,done
            )

    })

})


describe('cas_validate.redirect and cas_validate.ticket take two',function(){
    var app,server

    before(
        function(done){
            app = connect()
        app.use(cas.ssoff())
        app.use(cas.ticket({'cas_host':chost}))
        app.use(cas.check_and_return({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport+'/'}))
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
        login.use('/login',cas.check_or_redirect({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport+'/'}))
        login.use('/',app)

        server = login.listen(testport,done)

        })
after(function(done){
    server.close(done)
})


it('should redirect when no session is established',function(done){
    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){

        rq({url:'http://'+ testhost +':'+testport+'/login'
            ,followRedirect:false}
            ,function(e,r,b){
                r.statusCode.should.equal(307)
            r.headers.location.should.equal(casurl+'?service=http%3A%2F%2F'+ testhost +'%3A'+testport+'%2F')
            should.not.exist(b)
            cb()
            }
          )
    }]
    ,done
    )


})

it('should redirect when no session is established part deux',function(done){
    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){
        rq({url:'http://'+ testhost +':'+testport+'/'}
            ,function(e,r,b){
                r.statusCode.should.equal(200)
            should.exist(b)
            b.should.equal('hello world (not logged in)')
            cb(null, rq)
            }
          )
    }
    ,function(rq,cb){

        function all_done_handler(e,r,b){
            r.statusCode.should.equal(200)
        should.exist(b)
        b.should.equal('hello '+cuser)
        cb(e)
        }

        function redirect_handler(e,r,b){
            r.statusCode.should.equal(302)
                rq.get(r.headers.location
                        ,all_done_handler)
        }

        var form_handler = _login_handler(rq
                ,redirect_handler)
            rq({url:'http://'+ testhost +':'+testport+'/login'
                ,followRedirect:true}
                ,function(e,r,b){
                    r.statusCode.should.equal(200)
                form_handler(e,r,b)
                }
              )
    }

    ]
        ,done
        )


})

it('should not redirect when a session is established',function(done){

    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){

        // set up a session with CAS server
        cas_login_function(rq
            ,function(e){
                return cb(e,rq)
            })
    }
    ,function(rq,cb){
        rq({url:'http://'+ testhost +':'+testport+'/'}
            ,function(e,r,b){
                r.statusCode.should.equal(200)
            should.exist(b)
            b.should.equal('hello '+cuser)
            cb(e)
            }
          )

    }]
    ,done
        )

})

})

describe('stacking multiple cas_validate.ticket handlers',function(){
    var app,server

    before(
        function(done){
            app = connect()
        app.use(cas_validate.ssoff())
        app.use(cas.ticket({'cas_host':chost}))
        app.use(cas.ticket({'cas_host':chost}))
        app.use(cas.check_and_return({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport+'/'}))
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
        login.use('/login',cas.check_or_redirect({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport+'/'}))
        login.use('/',app)

        server = login.listen(testport,done)

        })
after(function(done){
    server.close(done)
})


it('should not crash, and should redirect when no session is established',function(done){
    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){

        rq({url:'http://'+ testhost +':'+testport+'/login'
            ,followRedirect:false}
            ,function(e,r,b){
                r.statusCode.should.equal(307)
            r.headers.location.should.equal(casurl+'?service=http%3A%2F%2F'+ testhost +'%3A'+testport+'%2F')
            should.not.exist(b)
            cb()
            }
          )
    }]
    ,done
    )


})

it('should not crash, and should should redirect when no session is established part deux',function(done){
    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){
        rq({url:'http://'+ testhost +':'+testport+'/'}
            ,function(e,r,b){
                r.statusCode.should.equal(200)
            should.exist(b)
            b.should.equal('hello world (not logged in)')
            cb(null, rq)
            }
          )
    }
    ,function(rq,cb){

        function all_done_handler(e,r,b){
            r.statusCode.should.equal(200)
        should.exist(b)
        b.should.equal('hello '+cuser)
        cb(e)
        }

        function redirect_handler(e,r,b){
            r.statusCode.should.equal(302)
                rq.get(r.headers.location
                        ,all_done_handler)
        }

        var form_handler = _login_handler(rq
                ,redirect_handler)
            rq({url:'http://'+ testhost +':'+testport+'/login'
                ,followRedirect:true}
                ,function(e,r,b){
                    r.statusCode.should.equal(200)
                form_handler(e,r,b)
                }
              )
    }

    ]
        ,done
        )


})

it('should not crash, and should should not redirect when a session is established',function(done){

    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){

        // set up a session with CAS server
        cas_login_function(rq
            ,function(e){
                return cb(e,rq)
            })
    }
    ,function(rq,cb){
        rq({url:'http://'+ testhost +':'+testport+'/'}
            ,function(e,r,b){
                r.statusCode.should.equal(200)
            should.exist(b)
            b.should.equal('hello '+cuser)
            cb(e)
            }
          )

    }]
    ,done
        )

})

})


describe('cas_validate.username',function(){

    var app,server;

    before(
        function(done){
            app = connect()
        .use(connect.cookieParser('barley Waterloo Napoleon Mareschal Foch'))
        .use(connect.session({ store: new RedisStore }))

        app.use('/username',cas.username)

        app.use(cas.ticket({'cas_host':chost}))
        app.use(cas.check_or_redirect({'cas_host':chost}))

        app.use('/',function(req, res, next){
            res.end('hello world')
        });
    server = app.listen(testport
        ,done)
        })
    after(function(done){
        server.close(done)
    })


    it('should reply with an empty json object when no session is established',function(done){
        async.waterfall([function(cb){
            _setup_request(cb)
        }
        ,function(rq,cb){

            rq({url:'http://'+ testhost +':'+testport+'/username'
                ,followRedirect:true}
                ,function(e,r,b){
                    r.statusCode.should.equal(200)
                should.exist(b)
                JSON.parse(b).should.have.property('user',null)
                cb()
                }
              )
        }]
        ,done
        )


    })

    it('should return the current user name when there is a session',function(done){

        async.waterfall([function(cb){
            _setup_request(cb)
        }
        ,function(rq,cb){

            // set up a session with CAS server
            cas_login_function(rq
                ,function(e){
                    return cb(e,rq)
                })
        }
        ,function(rq,cb){
            rq('http://'+ testhost +':'+testport+'/'
                ,function(e,r,b){

                    b.should.equal('hello world');
                    // session established, now we can get username
                    rq({url:'http://'+ testhost +':'+testport+'/username'}
                        ,function(e,r,b){
                            r.statusCode.should.equal(200)
                        should.exist(b)
                        var u = JSON.parse(b)
                        u.should.have.property('user',cuser)
                        cb()
                        }
                      )
                })

        }]
        ,done
            )

    })

})

// this is an express-only feature, as next('route') was removed from connect
describe('cas_validate.session_or_abort',function(){

    var app,server;

    before(
        function(done){
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

    app.use(cas.ticket({'cas_host':chost}))
        app.use(cas.check_or_redirect({'cas_host':chost}))

        app.use('/',function(req, res, next){
            res.end('hello world')
        });
    server=app.listen(testport
            ,done)
        })
after(function(done){
    server.close(done)
})

it('should skip to the next route if a session is not established',function(done){

    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){

        rq({url:'http://'+ testhost +':'+testport+'/secrets'
            ,followRedirect:true}
            ,function(e,r,b){
                r.statusCode.should.equal(200)
            should.exist(b)
            b.should.equal('public secrets')
            cb()
            }
          )
    }]
    ,done
    )
})
it('should pass through if a session is established',function(done){
    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){
        // set up a session with CAS server
        cas_login_function(rq
            ,function(e){
                return cb(e,rq)
            })
    }
    ,function(rq,cb){
        rq('http://'+ testhost +':'+testport+'/'
            ,function(e,r,b){

                b.should.equal('hello world');
                // session established, now we can get secrets
                rq({url:'http://'+ testhost +':'+testport+'/secrets'}
                    ,function(e,r,b){
                        r.statusCode.should.equal(200)
                    should.exist(b)
                    b.should.equal('super secret secrets')
                    cb()
                    }
                  )
            })

    }]
    ,done
        )

})
})

describe('cas_validate.ssoff',function(){


    var app,server;

    before(
        function(done){
            app = connect()
        .use(connect.bodyParser())
        .use(connect.cookieParser('barley Waterloo Napoleon Mareschal Foch'))
        .use(connect.session({ store: new RedisStore }))

        app.use('/username',cas.username)

        // note that ssoff has to go first, because otherwise the
        // CAS server itself doesn't have a valid session!
        app.use(cas.ssoff())
        app.use(cas.ticket({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport}))
        app.use(cas.check_or_redirect({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport}))

        app.use('/',function(req, res, next){
            res.end('hello world')
        });
    server=app.listen(testport
        ,done)
        })
after(function(done){
    server.close(done)
})

it('should delete the session when the user signs out of CAS server (single sign off)',function(done){
    if(testhost === '127.0.0.1'){
        // this test generally will fail unless CAS can post to this host
        console.log('\ntest aborted on 127.0.0.1.  Try re-running with the CAS_VALIDATE_TEST_URL set to a url that your CAS server can post to')
    return done()
    }

    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){
        // set up a session with CAS server
        cas_login_function(rq
            ,function(e){
                return cb(e,rq)
            })
    }
    ,function(rq,cb){

        rq('http://'+ testhost +':'+testport+'/'
            ,function(e,r,b){
                b.should.equal('hello world');
                // session established, now we can get username
                cb(e,rq)
            })
    }
    ,function(rq,cb){
        rq({url:'http://'+ testhost +':'+testport+'/username'}
            ,function(e,r,b){
                var u = JSON.parse(b)
            u.should.have.property('user',cuser)
            cb(e,rq)
            })
    }
    ,function(rq,cb){
        // now log out of CAS directly
        cas_logout_function(rq
                ,cb)
    }
    ,function(rq,cb){
        // and finally the real test
        rq({url:'http://'+ testhost +':'+testport+'/username'}
                ,function(e,r,b){
                    var u = JSON.parse(b)
            u.should.have.property('user',null)
            cb(e)
                })
    }]
    ,done
        )
        return null;
})

})


describe('cas_validate.logout',function(){


    var app,server;

    before(

        function(done){
            app = connect()
        .use(connect.bodyParser())
        .use(connect.cookieParser('barley Waterloo Napoleon loser'))
        .use(connect.session({ store: new RedisStore }))

        app.use('/username',cas.username)
        app.use('/quit',cas.logout({}))
        app.use(cas.ssoff())
        app.use(cas.ticket({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport}))
        app.use(cas.check_and_return({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport}))
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
        login.use('/login',cas.check_or_redirect({'cas_host':chost
            ,'service':'http://'+testhost+':'+testport+'/'}))
        login.use('/',app)
        server=login.listen(testport
                ,done)
        })
after(function(done){
    server.close(done)
})

it('should delete the session when the user signs out locally',function(done){

    async.waterfall([function(cb){
        _setup_request(cb)
    }
    ,function(rq,cb){
        // set up a session with CAS server
        cas_login_function(rq
            ,function(e){
                return cb(e,rq)
            })
    }
    ,function(rq,cb){

        rq('http://'+ testhost +':'+testport+'/'
            ,function(e,r,b){
                b.should.equal('hello '+cuser);
                // session established, now we can get username
                cb(e,rq)
            })
    }
    ,function(rq,cb){
        rq({url:'http://'+ testhost +':'+testport+'/username'}
            ,function(e,r,b){
                var u = JSON.parse(b)
            u.should.have.property('user',cuser)
            cb(e,rq)
            })
    }
    ,function(rq,cb){
        // now log out
        rq({url:'http://'+ testhost +':'+testport+'/quit'
            ,followRedirect:true}
            ,function(e,r,b){
                r.statusCode.should.equal(200)
            should.exist(b)
            b.should.equal('hello world (not logged in)')
            cb(e, rq)
            })
    }]
    ,done
        )
        return null;
})

})
*/
