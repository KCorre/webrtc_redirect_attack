var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  //req.session.count = req.session.count +1;
  //console.log(req.session.count);
  var db = req.db;
  var email = req.session.email;
  // new user
  if (!email) {
    res.render('index', {
      title: 'Express',
      email: null
    });
    return;
  }
  // returning user -> get username
  db.view('users', 'byEmail', {key: email}, function(err, body) {
    if (err) console.error(err);
    res.render('index', {
      title: 'Express',
      email: email,
      username: (body.rows[0] && body.rows[0].value)
    });
  });
});

router.get('/userlist', function(req, res){
  var db = req.db;
  var email = req.session.email;
  db.view('users', 'byEmail', function(err, body, header){
    if (err) {
      console.error('[nodetest1.list]', err.message);
      return;
    }
    res.render('userlist', {
      "userlist" : body.rows,
      title: 'Express',
      email: email,
      username: (req.session.email && req.session.username)
    });
  });
});

router.get('/newuser', function(req, res){
  res.render('newuser', {title: 'Add New User'});
});

/* POST to Add User Service */
router.post('/adduser', function(req, res) {

    // Set our internal DB variable
    var db = req.db;

    // Get our form values. These rely on the "name" attributes
    var userName = req.body.username;
    var userEmail = req.body.useremail;

    // Set our collection
    var collection = db.get('usercollection');

    // Submit to the DB
    db.insert({type:'user', username:userName, email:userEmail}, function (err, body, header) {
        if (err) {
            // If it failed, return error
            console.error('[nodetest1.insert]', err.message);
            res.send("There was a problem adding the information to the database.");
        }
        else {
            // If it worked, set the header so the address bar doesn't still say /adduser
            res.location("userlist");
            // And forward to success page
            res.redirect("userlist");
        }
    });
});

router.get('/webrtc', function(req, res){
	res.render('webrtc', {title: 'Webrtc conversation attack demo'})
})
router.get('/webrtc_attack', function(req, res){
	res.render('webrtc_attack', {title: 'Webrtc attacker demo'})
})

router.get('/.well-known/idp-proxy/default', function(req, res){
	var path = require('path');
	res.sendFile(path.resolve(__dirname+'/../public/javascripts/idpProxy.js'));
})

module.exports = router;
