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
var _ = require('underscore');

var async = require('async')

// var express = require('express')

var connect = require('connect')
var RedisStore = require('connect-redis')(connect);

var cas_validate = require('../lib/cas_validate')


// need to set up a server running bits and pieces of sas validate to test this properly.
// because the tests are responding to incoming connections.

function cas_login_function(rq,callback){
             var opts ={url:casurl}
             console.log(opts)
             rq(opts,function(e,r,b){
                 console.log(b)

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
                     console.log('boo')
                     if(success_regex.test(b)){
                         return callback()
                     }else{
                         return callback('CAS login failed')
                     }

                 })

             })
         }


function _setup_request(cb){
// make sure CAS can talk to request and not die a horrible death of a confused tomcat
    var jar = request.jar()
    var rq = request.defaults( {jar:jar
                                ,headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64; rv:12.0) Gecko/20100101 Firefox/12.0'}})
    cb(null,rq)
}

describe('cas_validate.redirect',function(){
    var app;
    before(
        function(done){
            app = connect()
                  //.use(connect.bodyParser())
                  .use(connect.cookieParser('barley wheat napoleon'))
                  .use(connect.session({ store: new RedisStore }))
                  .use(cas_validate.redirect({'cas_host':chost
                                             ,'service':'http://127.0.0.1:3000/index.html'})
                      )
                  .use(function(req, res, next){
                      should.not.exist(req)
                      res.end('hello world')
                  });
            http.createServer(app).listen(3000
                                         ,function(){
                                              done()
                                          });
        })

    it('should redirect when no session is established',function(done){

        async.waterfall([function(cb){
                             _setup_request(cb)
                         }
                        ,function(rq,cb){

                             rq({url:'http://127.0.0.1:3000/'
                                ,followRedirect:false}
                               ,function(e,r,b){
                                    r.statusCode.should.equal(307)
                                    r.headers.location.should.equal(casurl+'?service=http%3A%2F%2F127.0.0.1%3A3000%2Findex.html')
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
                             rq({url:'http://127.0.0.1:3000/'
                                ,followRedirect:false}
                               ,function(e,r,b){
                                    r.statusCode.should.equal(307)
                                    r.headers.location.should.equal(casurl+'?service=http%3A%2F%2F127.0.0.1%3A3000%2Findex.html')
                                    should.not.exist(b)
                                    cb()
                                }
                               )

                         }]
                       ,done
                       )
    })

})

// describe('cas_validate.check_or_redirect',function(){

//     // before(_before)

//     it('should redirect when no session is established',function(done){


//     })

//     it('should not redirect when a session is established',function(done){

//     })

// })

// describe('cas_validate.check_and_return',function(){

//     // before(_before)

//     it('should  when no session is established',function(done){


//     })

//     it('should not redirect when a session is established',function(done){

//     })

// })

// describe('cas_validate.ticket',function(){

//     // before(_before)

//     it('should  pass through when no ticket in the request',function(done){


//     })

//     it('should consume the ticket when in the request',function(done){

//     })

// })

// describe('cas_validate.ssoff',function(){

//     // before(_before)

//     it('should pass through when no ticket in the request',function(done){

//     })

//     it('should consume the ticket when in the request',function(done){

//     })

// })

// describe('cas_validate.username',function(){

//     // before(_before)

//     it('should return null if no session established',function(done){

//     })

//     it('should return the current user name when there is a session',function(done){

//     })

// })

// describe('cas_validate.session_or_abort',function(){

//     // before(_before)

//     it('should pass through if a session is established',function(done){

//     })

//     it('should skip to the next route if a session is not established',function(done){

//     })

// })

