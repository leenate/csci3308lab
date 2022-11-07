const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const axios = require('axios');


// database configuration
const dbConfig = {
    host: 'db',
    port: 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  };
  
  const db = pgp(dbConfig);
  

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(
    session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: false,
      resave: false,
    })
  );
  
  app.use(
    bodyParser.urlencoded({
      extended: true,
    })
  );

  app.listen(3000);
  console.log('Server is listening on port 3000');

// --------------------------------------------------------------------------------------------------------
// GET /
  app.get('/', (req, res) =>{
    res.redirect('/login'); //this will call the /anotherRoute route in the API
  });
// GET /LOGIN
  app.get('/login', (req, res) => {
    res.render('pages/login');
  });

// GET /REGISTER
  app.get('/register', (req, res) => {
    res.render('pages/register');
  });
  
// GET /LOGOUT
  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('pages/login', {message: `Logged out Successfully`},
    );

  });
// --------------------------------------------------------------------------------------------------------
// POST REGISTER
  app.post('/register', async (req, res) => {
    //the logic goes here
    const username = req.body.username;
    const password = req.body.password;
    const confirmpw = req.body.confirmpw;

    const hash = await bcrypt.hash(req.body.password, 10);
    const hash2 = await bcrypt.hash(req.body.confirmpw, 10);
    if (confirmpw != password){
      res.render('pages/register', {message: `Passwords do not match; please register again.`},)
    }
    
    const q = 'INSERT INTO users (username,password) VALUES ($1,$2)' ;

    db.none(q,[username,hash])
    .then(() => {
      res.redirect('/login'); 
    })
    .catch(function (err){  
    // If the insert fails, redirect to GET /register route.
      console.log(err);
      res.redirect('/register'); 
    })
    // Redirect to GET /login route page after data has been inserted successfully.
     
  });

// POST LOGIN
  app.post('/login', async (req, res) => {
    //the logic goes here
    const password  = req.body.password;
    const username = req.body.username;
 
    const q = 'SELECT username, password FROM users WHERE username = $1' ;

    db.one(q,[username])

    // if no username  res.redirect('/register'); 
    .then(async function (data){
      const match = await bcrypt.compare(req.body.password, data.password); //await is explained in #8

      if (match){   // If the user is found and password is correct, 
        req.session.user = {
          api_key: process.env.API_KEY,
        };
        req.session.save();
        res.redirect('/discover');   //redirect to /discover route after setting the session.
      }
      else{   // If pwd does not match
        res.render('pages/login', {message: `Incorrect username or password.`},)
      } 
    })
    .catch(function (err){  
     // If the database request fails, send an appropriate message to the user and render the login.ejs page.
       res.redirect('/register'); 
    })
  });

// --------------------------------------------------------------------------------------------------------
  // Authentication Middleware.
  const auth = (req, res, next) => {
    if (!req.session.user) {
      // Default to register page.
      return res.redirect('/register');
    }
    next();
  };
  // Authentication Required
  app.use(auth);
// --------------------------------------------------------------------------------------------------------

// GET DISCOVER
app.get('/discover', (req, res) => {
  axios({
    url: `https://app.ticketmaster.com/discovery/v2/events.json`,
        method: 'GET',
        dataType:'json',
        params: {
            "apikey": req.session.user.api_key,
            "keyword": "Arcade Fire", //you can choose any artist/event here
            "size": 10,
        }
    })
    .then(results => {
      console.log(results.data); // the results will be displayed on the terminal if the docker containers are running
      // Send some parameters
      res.render('pages/discover', {
        items: results.data,
      })
    })
    .catch(error => {
      // Handle errors
      res.render('pages/discover', {items: [], message: error},)
     })
});
