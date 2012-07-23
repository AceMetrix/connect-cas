var should = require('should')
var parseUrl = require('url').parse;
var http = require('http');
var request = require('request');
var querystring = require('querystring');
var redis = require("redis");

var env = process.env;
var chost = process.env.CAS_HOST;
var cuser = process.env.CAS_USER;
var cpass = process.env.CAS_PASS;
var casurl = 'https://'+chost + '/cas/login'

var testhost = env.CAS_VALIDATE_TEST_URL || '127.0.0.1'
var testport = env.CAS_VALIDATE_TEST_PORT || 3000

var _ = require('underscore');



var async = require('async')

var express = require('express')

var connect = require('connect')
var RedisStore = require('connect-redis')(connect);

var cas_validate = require('../lib/cas_validate')

var jar;
function _setup_request(cb){
// make sure CAS can talk to request and not die a horrible death of a confused tomcat
    // clear the cookies for the next test
    jar = request.jar()
    var rq = request.defaults( {jar:jar
                                ,headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64; rv:12.0) Gecko/20100101 Firefox/12.0'}})
    cb(null,rq)
}


// need to set up a server running bits and pieces of sas validate to test this properly.
// because the tests are responding to incoming connections.

function cas_login_function(rq,callback){
             var opts ={url:casurl}
             rq(opts,function(e,r,b){

                 // parse the body for the form url, with the correct jsessionid
                 var form_regex = /id="fm1".*action="(.*)" method="post"/;
                 var result = form_regex.exec(b)
                 opts.url='https://cas.ctmlabs.net'+result[1]
                 opts.form={'username':cuser
                           ,'password':cpass
                           ,'submit':'LOGIN'
                           }
                 // scrape hidden input values
                 var name_regex = /name="(.*?)"/
                     var value_regex = /value="(.*?)"/
                     var hidden_regex = /<input.*type="hidden".*?>/g
                 while ((result = hidden_regex.exec(b)) !== null)
                 {
                     var n = name_regex.exec(result[0])
                     var v = value_regex.exec(result[0])
                     opts.form[n[1]]=v[1]

                 }
                 rq.post(opts,function(e,r,b){
                     var success_regex = /Log In Successful/i;
                     if(success_regex.test(b)){
                         return callback()
                     }else{
                         return callback('CAS login failed')
                     }

                 })

             })
         }
function cas_logout_function(rq,callback){
             var logouturl = 'https://'+chost + '/cas/logout'
             rq(logouturl
               ,function(e,r,b){
                    callback(e,rq)
                })
         }



describe('cas_validate.redirect',function(){
    var app;
    var server;
    before(
        function(done){
            app = connect()
                  .use(connect.cookieParser('barley wheat napoleon'))
                  .use(connect.session({ store: new RedisStore }))
                  .use(cas_validate.redirect({'cas_host':chost
                                             ,'service':'http://'+ testhost +':'+testport+'/index.html'})
                      )
                  .use(function(req, res, next){
                      should.not.exist(req)
                      res.end('hello world')
                  });
            server = http.createServer(app).listen(testport
                                         ,function(){
                                              done()
                                          });
        })
    after(function(done){
        console.log('shut down server')
        server.close(function(e){
            if(e) throw new Error(e);
            done()
        })
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
                                    r.headers.location.should.equal(casurl+'?service=http%3A%2F%2F'+ testhost +'%3A'+testport+'%2Findex.html')
                                    should.not.exist(b)
                                    cb()
                                }
                               )
                         }]
                       ,done
                       )


    })

    it('should also redirect when session is established',function(done){

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
                             rq({url:'http://'+ testhost +':'+testport+'/'
                                ,followRedirect:false}
                               ,function(e,r,b){
                                    r.statusCode.should.equal(307)
                                    r.headers.location.should.equal(casurl+'?service=http%3A%2F%2F'+ testhost +'%3A'+testport+'%2Findex.html')
                                    should.not.exist(b)
                                    cb()
                                }
                               )

                         }]
                       ,done
                       )
    })

})

describe('cas_validate.check_and_return',function(){

    var app
    var server
    before(
        function(done){
            app = connect()
                  .use(connect.cookieParser('barley Waterloo Napoleon'))
                  .use(connect.session({ store: new RedisStore }))
            app.use(cas_validate.ticket({'cas_host':chost}))
            app.use('/valid'
                   ,function(req, res, next){
                        if(req.session && req.session.st){
                            return res.end('cas single sign on established in /valid path')
                        }else{
                            return res.end('hello world from /valid path, no session')
                        }

                    });
            app.use(cas_validate.check_and_return({'cas_host':chost
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
            server = http.createServer(app).listen(testport,done)

        })

    after(function(done){
        server.close(function(e){
            done()
        })
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
    var app;
    var server;
    before(
        function(done){
            app = connect()
                  .use(connect.cookieParser('barley Waterloo Napoleon'))
                  .use(connect.session({ store: new RedisStore }))
                  .use(cas_validate.ticket({'cas_host':chost}))
                  .use(cas_validate.check_or_redirect({'cas_host':chost})
                      )
                  .use(function(req, res, next){
                      res.end('hello world')
                  });
            server = http.createServer(app).listen(testport
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


describe('cas_validate.username',function(){

    var app;
    var server;
    before(
        function(done){
            app = connect()
                  .use(connect.cookieParser('barley Waterloo Napoleon Mareschal Foch'))
                  .use(connect.session({ store: new RedisStore }))

            app.use('/username',cas_validate.username)

            app.use(cas_validate.ticket({'cas_host':chost}))
            app.use(cas_validate.check_or_redirect({'cas_host':chost}))

            app.use('/',function(req, res, next){
                      res.end('hello world')
                  });
            server = http.createServer(app).listen(testport
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

    var app;
    var server;
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

            app.use(cas_validate.ticket({'cas_host':chost}))
            app.use(cas_validate.check_or_redirect({'cas_host':chost}))

            app.use('/',function(req, res, next){
                      res.end('hello world')
                  });
            server = http.createServer(app).listen(testport
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


    var app;
    var server;
    before(
        function(done){
            app = connect()
                  .use(connect.cookieParser('barley Waterloo Napoleon Mareschal Foch'))
                  .use(connect.session({ store: new RedisStore }))

            app.use('/username',cas_validate.username)

            app.use(cas_validate.ticket({'cas_host':chost}))
            app.use(cas_validate.check_or_redirect({'cas_host':chost}))
            app.use(cas_validate.ssoff())
            app.use('/',function(req, res, next){
                      res.end('hello world')
            });
            server = http.createServer(app).listen(testport
                                                  ,done)
        })
    after(function(done){
        server.close(done)
    })

    it('should delete the session when the user signs out of CAS server (single sign off)',function(done){
        if(testhost === '127.0.0.1'){
            // this test generally will fail unless CAS can post to this host
            done(new Error('test aborted on 127.0.0.1.  Try re-running with the CAS_VALIDATE_TEST_URL set to a url that your CAS server can post to'))
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
                                                ,function(e){
                                                     cb(e,rq)
                                                 })
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

    })

})
