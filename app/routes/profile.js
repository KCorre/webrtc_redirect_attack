var express = require('express');
var router = express.Router();

/**
 * GET /profile
 *
 * Identify user via session and get information from db.
 */
router.get('/', function(req, res) {
  var db = req.db;
  var email = req.session.email;

  
  //Don't need to access db for now
  //db.view('users', 'byEmail', {key: email}, function(err, body) { }
  res.render('profile', {
      title: 'Your profile',
      email: req.session.email,
      username: (req.session.username && req.session.username)
  });

});

/**
 * POST /profile
 *
 * Handle post request and save username to db.
 */
router.post('/', function(req, res) {
  var db = req.db;
  var email = req.session.email;
  var username = req.body.username;

  // get document from db
  db.view('users', 'docByEmail', {key: email}, function(err, body) {
    if (err) console.log(err);
    var doc = body.rows[0].value;
    doc.username = username
    req.session.username = username;
    
    db.insert(doc, doc._id, function(err, ins_res) {
      if (err) console.log('No update!');
      else console.log('Updated!');
    });
    res.render('profile', {
      title: 'Your profile',
      email: req.session.email,
      username: (req.session.email && req.session.username)
    });
  });
});

module.exports = router;