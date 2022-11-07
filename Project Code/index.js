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

// test your database
db.connect()
    .then(obj => {
        console.log('Database connection successful'); // you can view this message in the docker compose logs
        obj.done(); // success, release the connection;
    })
    .catch(error => {
        console.log('ERROR:', error.message || error);
    });

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

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('Pages/login');
});
app.get('/bookPreferences', (req, res) => {
    res.render('Pages/bookPreferences');
});
app.get('/logout', (req, res) => {
    res.render('Pages/logout');
});
app.get('/matches', (req, res) => {
    res.render('Pages/matches');
});
app.get('/wishlist', (req, res) => {
    res.render('Pages/wishlist');
});
app.post('/submit_books', (req, res) => {
    //ACTUALLY SUBMIT BOOKS HERE
    res.render('Pages/login');
});
app.get('/searchBooks', (req, res) => {
    axios({
        url: `https://www.goodreads.com/search.xml?key=OAuth&q=Ender%27s+Game`,
        method: 'GET',
        dataType:'json',
        params: {
            "apikey": req.session.user.api_key,
            "keyword": "Ender", //input, //you can choose any artist/event here
            "size": 10,
        }
    })
    .then(results => {
        console.log(results.data); // the results will be displayed on the terminal if the docker containers are running
        res.render('Pages/searchBooks',{
            results: results.data._embedded.events
        }) 
    })
    .catch(err => {
        res.render('Pages/searchBooks',{
          results: [],
          error: true,
          message: err.message,
        })
    })

});
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

app.listen(3000);
console.log('Server is listening on port 3000');