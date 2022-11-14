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
app.get('/register', (req, res) => {
    res.render('pages/register');
});
app.get('/review', (req, res) => {
    res.render('pages/submit_review');
});
app.get('/reviews', (req, res) => {
    res.render('pages/show_reviews');
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
app.get('/recommendation', (req, res) => {
    res.render('Pages/recommendation');
});
app.post('/submit_books', (req, res) => {
    //ACTUALLY SUBMIT BOOKS HERE
    res.render('Pages/login');
});
//TODO: add input to user_to_book table based on session var
//TODO: add error checking
app.post('/submit_books', async (req, res) => {
    // Split csv values into array
    const bookPrefs = req.body.ISBN;
    let isbnArr = bookPrefs.split(',');

    var options = {
        "async": true,
        "crossDomain": true,
        "method" : "GET",
        "headers" : {
          "CLIENT_TOKEN" : "my-api-key",
          "cache-control": "no-cache"
        }
      };

    // Build query by adding on the values to the base query. No error checking as of now
    let query = "INSERT INTO books(ISBN,name) VALUES "
    for (let i = 0; i < isbnArr.length; i++) { 
        let urlformat = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbnArr[i];
        let book = "";
        await axios({
               url: urlformat,
               method: 'GET',
               dataType:'json',
            })
            .then(results => {
              results.data.items[0].volumeInfo.title;
              console.log(results.data.items[0].volumeInfo.title);
              book = results.data.items[0].volumeInfo.title;
            })
            .catch(error => {
               console.log(error);
            })

        //if (results.totalItems) {
            // There'll be only 1 book per ISBN
            //let book = results.items[0];

            //let title = book['volumeInfo']['title'];
            //let subtitle = book['volumeInfo']['subtitle'];
            //let authors = book['volumeInfo']['authors'];
            //let printType = book['volumeInfo']['printType'];
            //let pageCount = book['volumeInfo']['pageCount'];
            //let publisher = book['volumeInfo']['publisher'];
            //let publishedDate = book['volumeInfo']['publishedDate'];
            //let webReaderLink = book['accessInfo']['webReaderLink'];

            // For debugging
            //Logger.log(book);
            console.log("book")
            console.log(book);
            //let title = book['volumeInfo']['title'];
            if(book){
            query += "(" + isbnArr[i] + ",'" + book  + "'),";
            }
    }
    query = query.substring(0,query.length - 1); // remove final comma
    query += " RETURNING *;"

    db.one(query)
        .then(async data => {
            res.render('Pages/wishlist');
        })
        .catch(err => {
            console.log(err);
            res.render('Pages/wishlist');
        });
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
