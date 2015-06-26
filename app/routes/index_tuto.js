var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

router.get('/helloworld', function(req, res){
  res.render('helloworld', {title: 'Hello World'});
});

router.get('/fill_db', function(req, res){
  var db = req.db;
  db.insert({type:'user', username:'user1', email:'user1@mail.net'});
  db.insert({type:'user', username:'user2', email:'user2@mail.net'});
  db.insert({type:'user', username:'user3', email:'user3@mail.net'});
  console.log('ok!');
  return;
});

router.get('/userlist', function(req, res){
  var db = req.db;
  db.view('user', 'userlist', function(err, body, header){
    if (err) {
      console.error('[nodetest1.list]', err.message);
      return;
    }
    console.log(body);
    res.render('userlist', {
      "userlist" : body.rows
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


module.exports = router;
