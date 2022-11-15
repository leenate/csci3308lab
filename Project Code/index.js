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

app.get('/searchBooks', async(req, res) => {
    //res.render('Pages/searchBooks');

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
    //var query = "SELECT * FROM books WHERE"
    //for (let i = 0; i < isbnArr.length; i++) { 
        let urlformat = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + 'flowers';
        let book = "";
        await axios({
               url: urlformat,
               method: 'GET',
               dataType:'json',
               params: {
                //"keyword": "flowers", //change based on search bar input value
                "size": 10,
                }
            })
            .then(results => {
              console.log(results.data.items[0].volumeInfo.title);
              res.render('Pages/searchBooks', {
                results: results.data.items //.title;
              })
            })
            .catch(error => {
               console.log(error);
               res.render('Pages/searchBooks',{
                results: [],
                error: true
              })
            })

            // For debugging
            console.log("book")
            console.log(book);
            
            // if(book){
            // query += "(" + isbnArr[i] + ",'" + book  + "'),";
            // }
    //}
    //query = query.substring(0,query.length - 1); // remove final comma
    //query += " RETURNING *;"

    // db.one(query)
    //     .then(async data => {
    //         res.render('Pages/searchBooks');
    //     })
    //     .catch(err => {
    //         console.log(err);
    //         res.render('Pages/searchBooks');
    //     });
    // });
    // // Authentication Middleware.
    // const auth = (req, res, next) => {
    //     if (!req.session.user) {
    //       // Default to register page.
    //       return res.redirect('/register');
    //     }
    //     next();

});

// Authentication Required
app.use(auth);

app.listen(3000);
console.log('Server is listening on port 3000');