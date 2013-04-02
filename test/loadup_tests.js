var should = require('should')
var parseUrl = require('url').parse;
var http = require('http');
var request = require('request');
var querystring = require('querystring');
var redis = require("redis");

var env = process.env;
var chost = env.CAS_HOST;
var cuser = env.CAS_USER;
var cpass = env.CAS_PASS;

var testhost = env.CAS_VALIDATE_TEST_URL || '127.0.0.1'
var testport = env.CAS_VALIDATE_TEST_PORT || 3000

testport++

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

function _login_handler(rq,callback){
    return function(e,r,b){
        // parse the body for the form url, with the correct jsessionid
        //console.log(b)
        var form_regex = /id="fm1".*action="(.*)" method="post"/;
        var result = form_regex.exec(b)
        var opts={}
        opts.url=casservice+result[1]
        opts.form={'username':cuser
                  ,'password':cpass
                  ,'submit':'LOGIN'
                  }
        opts.followRedirect=true
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
        // console.log('opts is' )
        // console.log(opts)
        // console.log('--' )
        rq.post(opts,callback)
    }
}

function cas_login_function(rq,callback){
             var opts ={url:casurl}

             rq(opts
               ,_login_handler(rq
                              ,function(e,r,b){
                                   var success_regex = /Log In Successful/i;
                                   if(success_regex.test(b)){
                                       return callback()
                                   }else{
                                       console.log(opts)
                                       console.log(b)
                                       return callback('CAS login failed')
                                   }
                               }) )
         }

function cas_logout_function(rq,callback){
    var logouturl = 'https://'+chost + '/cas/logout';
    rq(logouturl
       ,function(e,r,b){
           // give the server a chance to fire off its post
           setTimeout(function(){
               callback(e,rq)
           },100)
       })
}


describe('intialize without http or https',function(){
    var casservice = chost+'/'
    var casurl = casservice + 'cas/login'
    var thisport = testport++


    it('should initialize properly'
      ,function(done){
           var app = connect()
                     .use(connect.cookieParser('barley wheat napoleon'))
                     .use(connect.session({ store: new RedisStore }))
                     .use(cas_validate.redirect({'cas_host':chost
                                                ,'service':'http://'+ testhost +':'+thisport+'/index.html'})
                         )
                     .use(function(req, res, next){
                         should.not.exist(req)
                         res.end('hello world')
                     });
           var server = app.listen(thisport,testhost,function(err){
                            should.not.exist(err)
                            // make sure the server can do something
                            async.waterfall([function(cb){
                                                 _setup_request(cb)
                                             }
                                            ,function(rq,cb){
                                                 rq({url:'http://'+ testhost +':'+thisport+'/'
                                                    ,followRedirect:false}
                                                   ,function(e,r,b){
                                                        r.statusCode.should.equal(307)
                                                        r.headers.location.should.equal('https://'+casurl+'?service=http%3A%2F%2F'+ testhost +'%3A'+thisport+'%2Findex.html')
                                                        should.not.exist(b)
                                                        cb()
                                                    }
                                                   )
                                             }]
                                           ,done
                                           )
                        })
       })
})
describe('intialize with http',function(){
    var casservice = chost+'/'
    var casurl = casservice + 'cas/login'
    var thisport = testport++


    it('should initialize properly and force https'
      ,function(done){
           var app = connect()
                     .use(connect.cookieParser('barley wheat napoleon'))
                     .use(connect.session({ store: new RedisStore }))
                     .use(cas_validate.redirect({'cas_host':'http://'+chost
                                                ,'service':'http://'+ testhost +':'+thisport+'/index.html'})
                         )
                     .use(function(req, res, next){
                         should.not.exist(req)
                         res.end('hello world')
                     });
           var server = app.listen(thisport,testhost,function(err){
                            should.not.exist(err)
                            // make sure the server can do something
                            async.waterfall([function(cb){
                                                 _setup_request(cb)
                                             }
                                            ,function(rq,cb){
                                                 rq({url:'http://'+ testhost +':'+thisport+'/'
                                                    ,followRedirect:false}
                                                   ,function(e,r,b){
                                                        r.statusCode.should.equal(307)
                                                        r.headers.location.should.equal('https://'+casurl+'?service=http%3A%2F%2F'+ testhost +'%3A'+thisport+'%2Findex.html')
                                                        should.not.exist(b)
                                                        cb()
                                                    }
                                                   )
                                             }]
                                           ,done
                                           )
                        })
       })
})
describe('intialize with https',function(){
    var casservice = chost+'/'
    var casurl = casservice + 'cas/login'
    var thisport = testport++


    it('should initialize properly and force https'
      ,function(done){
           var app = connect()
                     .use(connect.cookieParser('barley wheat napoleon'))
                     .use(connect.session({ store: new RedisStore }))
                     .use(cas_validate.redirect({'cas_host':'https://'+chost
                                                ,'service':'http://'+ testhost +':'+thisport+'/index.html'})
                         )
                     .use(function(req, res, next){
                         should.not.exist(req)
                         res.end('hello world')
                     });
           var server = app.listen(thisport,testhost,function(err){
                            should.not.exist(err)
                            // make sure the server can do something
                            async.waterfall([function(cb){
                                                 _setup_request(cb)
                                             }
                                            ,function(rq,cb){
                                                 rq({url:'http://'+ testhost +':'+thisport+'/'
                                                    ,followRedirect:false}
                                                   ,function(e,r,b){
                                                        r.statusCode.should.equal(307)
                                                        r.headers.location.should.equal('https://'+casurl+'?service=http%3A%2F%2F'+ testhost +'%3A'+thisport+'%2Findex.html')
                                                        should.not.exist(b)
                                                        cb()
                                                    }
                                                   )
                                             }]
                                           ,done
                                           )
                        })
       })
})
