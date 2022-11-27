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
    if (req.session.user){
        res.redirect('/wishlist');
    }
    res.render('Pages/login');
});
app.get('/bookPreferences', (req, res) => {
    if (! req.session.user){
        res.redirect('/login');
    }
    res.render('Pages/bookPreferences');
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('Pages/logout');
});
// app.get('/matches', (req, res) => {
//     if (! req.session.user){
//         res.redirect('/login');
//     }
//     res.render('Pages/matches');
// });
//app.get('/wishlist', (req, res) => {
    //if (! req.session.user){
        //res.redirect('/login');
    //}
    //res.render('Pages/wishlist');
//});
app.get('/register', (req, res) => {
    if (req.session.user){
        res.redirect('/wishlist');
    }
    res.render('pages/register');
});
app.get('/review', (req, res) => {
    if (! req.session.user){
        res.redirect('/login');
    }
    res.render('pages/submit_review');
});
app.get('/reviews', (req, res) => {
    if (! req.session.user){
        res.redirect('/login');
    }
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
            username: data.username,
            api_key: process.env.API_KEY,
        };
        req.session.save();
        res.redirect('/submit_books');   //redirect to /discover route after setting the session.
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

app.get('/users', (req, res) => {
    //const user = "SELECT DISTINCT books.name, books.ISBN FROM books JOIN user_to_book ON books.ISBN = user_to_book.book_ISBN JOIN users ON user_to_book.user_id = users.user_id WHERE users.username = daisy;";
    const user = "SELECT * FROM user_to_book;";
    db.task('fucking_work', task => {
        return task.batch([
            task.any(user)
        ]);
    })
    .then(rows => {
        res.send(rows);
    })
    .catch(err => {
        console.log(err);
    });
});

//simpler wishlist w/o axios

app.get('/wishlist', (req, res) => {
    if (! req.session.user){
        res.redirect('/login');
    }
    const username = req.session.user.username;
    const query = "SELECT DISTINCT books.name, books.ISBN FROM books JOIN user_to_book ON books.ISBN = user_to_book.book_ISBN JOIN users ON user_to_book.user_id = users.user_id WHERE users.username = '" + username + "';";
    db.task('get-books', task => {
        return task.batch([
            task.any(query)
        ]);
    })
    .then(data => {
        res.status('200');
        res.render('pages/wishlist', {
            books: data,
            user: username, 
        })
    })
    .catch(err => {
        console.log(err)
        res.render('pages/wishlist', {
            books: [],
            user: '',
            error: true,
            message: err.message,
        });
    });
});

//TO-DO: finish get/wishlist with axios

//app.get('/wishlist', async (req, res) => {
    //if (! req.session.user){
        //res.redirect('/login');
    //}
    //let isbn = [];
    //const query = `SELECT book_ISBN FROM user_to_book WHERE user_id = '` + req.session.user.user_id + `';`;
    //console.log(query);
    //await db.one(query)
        //.then(data => {
            //console.log(data);
            //console.log("data")
            //isbn = data;
    //})
    //isbn.forEach(async function(i) {
        //let url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + i;
        //await axios({
            //url: url,
            //method: 'GET',
            //dataType: 'json',
            //params: {
                //"apikey": 'AIzaSyC5jtRuu7EPChBowPDQDL39u-mQMjKZuRo'
            //}
        //})
        //.then(results => {
            //console.log(results);
            //i = results;
        //})
        //.catch(err => {
            //console.log(err);
        //})
    //})
//db.one(isbn)
    //.then(function(results) {
        //res.status('200');
        //res.render('pages/wishlist', {
            //books: results,
        //})
    //})
    //.catch(err => {
        //console.log(err)
        //res.render('pages/wishlist', {
        //books: [],
        //});
    //});
//});

//app.post('/wishlist', (req, res) => {
    //db.task('delete-book', task => {
        //return task.batch([
            //task.none(
                //`DELETE FROM 
                //user_to_book
                //WHERE
                //book_ISBN = $1
                //AND user_id = $2;`,
                //[req.session.user.user_id, parseInt(req.body.book_ISBN)]
            //),
            //task.any(user_to_book, [req.session.user.user_id]),
        //]);
    //})
    //.then(([, results]) => {
        //console.log(results.data);
        //res.render('pages/wishlist', {
            //results: results.data,
            //message: `Successfully removed ${req.body.name} from wishlist`,
            //action: 'delete',
        //});
    //})
    //.catch(err => {
        //res.render('pages/wishlist', {
            //results: [],
            //error: true,
            //message: err.message,
        //});
    //});
//});

// ---------------Recommendation-----------------------------------------------------------------------------------------
app.get('/recommendation', (req, res) => {
  const find = req.body.find;
  var options = {
    "async": true,
    "crossDomain": true,
    "method" : "GET",
    "headers" : {
      "CLIENT_TOKEN" : "my-api-key",
      "cache-control": "no-cache"
    }
  };
  var url = 'https://www.googleapis.com/books/v1/volumes?q=intitle:'+ find;
  axios({
      url: url,
      method: 'GET',
      dataType: 'json',
      params: {
          "apikey": 'AIzaSyC5jtRuu7EPChBowPDQDL39u-mQMjKZuRo',
          "size": 10
      } 
  })
  .then(results => {
      console.log(results.data);
      res.render('pages/recommendation', {
          results: results.data,
      });
  })
  .catch(err => {
      res.render('pages/recommendation', {
          results: [],
          error: true,
          message: err.message,
      });
  });
});

app.post('/recommendation', (req, res) => {
  db.task('delete-book', task => {
      return task.batch([
          task.none(
              `DELETE FROM 
              user_to_book
              WHERE
              book_ISBN = $1
              AND user_id = $2;`,
              [req.session.user.user_id, parseInt(req.body.book_ISBN)]
          ),
          task.any(user_to_book, [req.session.user.user_id]),
      ]);
  })
  .then(([, results]) => {
      console.log(results.data);
      res.render('pages/recommendation', {
          results: results.data,
          message: `Successfully removed ${req.body.name} from wishlist`,
          action: 'delete',
      });
  })
  .catch(err => {
      res.render('pages/recommendation', {
          results: [],
          error: true,
          message: err.message,
      });
  });
});

// app.get('/recommendation', (req, res) => {
//     res.render('Pages/recommendation');
// });
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
    let user_id = "";
    query2 = "SELECT user_id FROM users WHERE username = '" + req.session.user.username + "';"
    console.log(query2);
    await db.one(query2)
        .then(function (data){
            console.log(data);
            console.log("data")
            user_id=data.user_id;
        })
        .catch(err => {
            console.log(err);
        });
    
    let associationQuery = "INSERT INTO user_to_book (user_id, book_isbn) VALUES ";
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
                associationQuery += "(" + user_id + "," + isbnArr[i] + "),";
            }
    }
    query = query.substring(0,query.length - 1); // remove final comma
    associationQuery = associationQuery.substring(0,associationQuery.length - 1); // remove final comma
    query += " RETURNING *;"
    associationQuery += " RETURNING *;"
    console.log(req.session.user.username)

    db.one(query)
        .then(async data => {
            db.one(associationQuery)
                .then(async data => {
                    res.render('Pages/wishlist');
                })
                .catch(err => {
                    console.log(err);
                    res.render('Pages/wishlist');
                });
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
    const bookSearch = req.body.beanin; //'flowers'; //for testing
    console.log("search: ", req.body);
    
    var options = {
        "async": true,
        "crossDomain": true,
        "method" : "GET",
        "headers" : {
          "CLIENT_TOKEN" : "my-api-key",
          "cache-control": "no-cache"
        }
      };

    let urlformat = 'https://www.googleapis.com/books/v1/volumes?q=' + bookSearch;
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
            results: results.data.items
            })
        })
        .catch(error => {
            console.log(error);
            res.render('Pages/searchBooks',{
            results: [],
            error: true
            })
        })

});
app.post('/searchBooks/search', async(req, res) => {
    //res.render('Pages/searchBooks');
    const bookSearch = req.body.beanin; //'flowers'; //for testing
    console.log("search: ", req.body);
    
    var options = {
        "async": true,
        "crossDomain": true,
        "method" : "GET",
        "headers" : {
          "CLIENT_TOKEN" : "my-api-key",
          "cache-control": "no-cache"
        }
      };

    let urlformat = 'https://www.googleapis.com/books/v1/volumes?q=' + bookSearch;
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
        results: results.data.items
        })
    })
    .catch(error => {
        console.log(error);
        res.render('Pages/searchBooks',{
        results: [],
        error: true
        })
    })
});

// GET MATCHES & FRIENDS

app.get('/matches', (req, res) => {
  const matches = 'SELECT username FROM users ORDER BY username ASC LIMIT 10;';
  const friends = `SELECT username FROM users ORDER BY username DESC LIMIT 10`;
  db.task('get-everything', task => {
    return task.batch([
      task.any(matches),
      task.any(friends)
    ]);
  })
  .then(data => {
    res.status('200')
    res.render('Pages/matches', {
      matches: data[0],
      friends: data[1],
    })
  })
  .catch(err => {
      console.log(err)
      res.render('Pages/matches', {
        matches: '',
        friends: '',
      })
  })
});


// Authentication Required
app.use(auth);

app.listen(3000);
console.log('Server is listening on port 3000');
