var https = require('https');
var fs = require('fs');
var options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var csurf = require('csurf');
var cookieSession = require('cookie-session');
var cookie = require('cookie');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
//var methodOverride = require('method-override')
//var errorhandler = require('errorhandler');
var redis = require('connect-redis')(expressSession);
var sessionStore = new redis({
        host: 'localhost',
        port: 6379,
        db: 2
    });

var nano = require('nano')('http://kcorre:Nesquiq87@localhost:5984');
var db_name = 'nodetest1';
var db = nano.use(db_name);
//db.update = function(obj, key, callback) {
// var db = this;
// db.get(key, function (error, existing) { 
//  if(!error) obj._rev = existing._rev;
//  db.insert(obj, key, callback);
// });
//}

var app = express();

var COOKIE_SECRET = 'julescesar';
var COOKIE_NAME = 'sid';

// csp middleware
// Important: twitter and ghbtns are not needed!
// script-src 'unsafe-inline' is needed for twitter and bootstrap
// they are here for the demo
// style-src 'unsafe-inline' is required for chrome+jquery bug
var policy =  "default-src 'self';" +
              "frame-src 'self' https://login.persona.org https://platform.twitter.com http://platform.twitter.com http://ghbtns.com;" +
              "script-src 'self' 'unsafe-inline' https://login.persona.org http://platform.twitter.com;" +
              "style-src 'self' 'unsafe-inline'";

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
//app.use(cookieSession({
//    key: 'app.session',
//    secret: COOKIE_SECRET
//}));
app.use(expressSession({
    name: COOKIE_NAME,
    store: sessionStore,
    secret: COOKIE_SECRET,
    saveUninitialized: true,
    resave: true,
    cookie: {
        path: '/',
        httpOnly: true,
        secure: false,
        maxAge: null
    }
}));


var server = https.Server(options, app);
var io = require('socket.io').listen(server);

io.use(function(socket, next){
    try{
        var data = socket.handshake || socket.request;
        if (! data.headers.cookie) {
            return next(new Error('Missing cookie headers'));
        }
        console.log('cookie header (%s)', JSON.stringify(data.headers.cookie));
        var cookies = cookie.parse(data.headers.cookie);
        console.log('cookie parsed (%s)', JSON.stringify(cookies));
        if (!cookies[COOKIE_NAME]) {
            return next(new Error('Missing cookie '+ COOKIE_NAME));
        }
        var sid = cookieParser.signedCookie(cookies[COOKIE_NAME], COOKIE_SECRET);
        if (!sid) {
            return next(new Error('Cookie signature is not valid'));
        }
        console.log('session ID (%s)', sid);
        data.sid = sid;
        sessionStore.get(sid, function(err, expressSession){
            if(err) return next(err);
            if (! expressSession) return next(new Error('session not found'));
            data.session = expressSession;
            next();
        });
    } catch(err) {
        console.error(err.stack);
        next(new Error('Internal server error'));
    }
});


// ROUTES
var routes = require('./routes/index');
var auth = require('./routes/auth');
var users = require('./routes/users');
var profile = require('./routes/profile');


app.use(express.static(path.join(__dirname, 'public')));

//app.use(methodOverride);
app.use(csurf());

// custom middleware
app.use(function(req, res, next) {
  // csrf
  console.log("Session "+req.session)
  res.locals.token = req.csrfToken();
  //// cookie
  //if (req.session.email) {
  //  res.cookie('email', req.session.email);
  //}
  // continue with router
  next();
});

// middleware to restrict access to internal routes
function restrict(req, res, next) {
  if (req.session.email) {
    next();
  } else {
    res.redirect('/');
  }
}

// set username to null for all routes
// means we only have to pass it to our views when we actually have a username
app.locals.username = null;

//Make db accessible
//Must be above route definition
app.use(function(req, res, next){
    req.db = db;
    next();
})

app.use('/', routes);
app.use('/auth', auth);
app.use('/users', users);
app.use('/profile', profile);

// IO CHAT
io.on('connection', function(socket){
    var session = socket.request.session || socket.handshake.session;
    var username;
    
  // convenience function to log server messages on the client
	function log(){
		var array = [">>> Message from server: "];
	  for (var i = 0; i < arguments.length; i++) {
	  	array.push(arguments[i]);
	  }
	    socket.emit('log', array);
	}
    
    socket.on('disconnect', function(){
      console.log((session.username || 'user') +' disconnected');
      io.emit('chat message', (session.username || 'user') +' disconnected');
    });
  
    socket.on('chat message', function(msg){
      console.log('message: ' + msg);
      io.emit('chat message', (session.username || 'user') + ': ' + msg);
    });
    
    socket.on('webrtc_signal', function(msg){
        console.log('webrtc_signal: '+msg);
        socket.broadcast.emit('webrtc_signal', msg);
    });
    socket.on('webrtc_attack', function(msg){
        console.log('webrtc_attack: '+msg);
        socket.broadcast.emit('webrtc_attack', msg);
    });

    socket.on('create or join', function (room) {
            var numClients = io.sockets.adapter.rooms[room] || 0;
            log('Room ' + room + ' has ' + numClients + ' client(s)');
            log('Request to create or join room', room);

            if (numClients == 0){
                    socket.join(room);
                    socket.emit('created', room);
            } else if (numClients == 1) {
                    io.sockets.in(room).emit('join', room);
                    socket.join(room);
                    socket.emit('joined', room);
            } else { // max two clients
                    socket.emit('full', room);
            }
            socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
            socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room);

	});
});

// HANDLERS

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

app.set('port', process.env.PORT || 6370);
server.listen(app.get('port'), function(){
    console.log('listening on '+ server.address().port);
});

module.exports = app;
