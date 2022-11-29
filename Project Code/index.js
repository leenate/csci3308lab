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
    res.redirect('/submit_books');
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
app.get('/wishlist', (req, res) => {
    if (! req.session.user){
        res.redirect('/login');
    }
    res.render('Pages/wishlist');
});
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
app.get('/submit_books', (req, res) => {
    if (! req.session.user){
        res.redirect('/login');
    }
    query = "SELECT books.name,books.imageloct,books.isbn FROM books JOIN user_to_book ON books.isbn = user_to_book.book_isbn JOIN users ON user_to_book.user_id = users.user_id WHERE users.username = '" + req.session.user.username + "';";
    db.any(query)
        .then(async results => {
            res.render('Pages/bookPreferences',{
                "results": results
              });
        })
        .catch(err => {
            console.log(err);
            res.render('Pages/bookPreferences',{
                "results": results
              });
        });
});

app.post('/removeFromPreferences/:isbn', async (req, res) => {
    query_for_userid = "SELECT user_id FROM users WHERE username = '" + req.session.user.username + "';"
    user_id="";
    await db.one(query_for_userid)
        .then(function (data){
            user_id=data.user_id;
        })
        .catch(err => {
            console.log(err);
        });
    delete_query = "DELETE FROM user_to_book WHERE user_id = " + user_id + " AND book_isbn = " + req.params.isbn +  ";";
    console.log(delete_query);
    db.none(delete_query)
        .then(function (data){
            res.redirect('/submit_books');
        })
        .catch(err => {
            console.log(err);
            res.redirect('/submit_books');
        });
});
app.post('/submit_books', async (req, res) => {
    let ISBN1 = req.body.ISBN1;
    let ISBN2 = req.body.ISBN2;
    let ISBN3 = req.body.ISBN3;
    let ISBN4 = req.body.ISBN4;
    let ISBN5 = req.body.ISBN5;
    let isbnArr = [ISBN1, ISBN2, ISBN3, ISBN4, ISBN5];

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
    await db.one(query2)
        .then(function (data){
            user_id=data.user_id;
        })
        .catch(err => {
            console.log(err);
        });
    
    let associationQuery = "INSERT INTO user_to_book (user_id, book_isbn) VALUES ";
    let query = "INSERT INTO books(ISBN,name,imageloct) VALUES ";
    let count = 0;
    for (let i = 0; i < isbnArr.length; i++) { 
        if (isbnArr[i] == "") {
            continue;
        }
        console.log(isbnArr[i]);
        let urlformat = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbnArr[i];
        let book = "";
        let imageloct = "";
        await axios({
               url: urlformat,
               method: 'GET',
               dataType:'json',
            })
            .then(results => {
                console.log(results.data.items[0].volumeInfo.imageLinks.smallThumbnail);
                results.data.items[0].volumeInfo.title;
                book = results.data.items[0].volumeInfo.title;
                imageloct = results.data.items[0].volumeInfo.imageLinks.smallThumbnail;
            })
            .catch(error => {
               console.log(error);
            })

            if (book == undefined || book == "" || isbnArr[i] == undefined || isbnArr[i] == "") { 
                continue
            }
            //let title = book['volumeInfo']['title'];
            if(book){
                query += "(" + isbnArr[i] + ",'" + book  + "','" +  imageloct + "'),";
                associationQuery += "(" + user_id + "," + isbnArr[i] + "),";
                count++;
            }
    }
    if (count == 0){
        res.render('Pages/bookPreferences', {message: "No books were added"});
        return;
    }
    query = query.substring(0,query.length - 1); // remove final comma
    associationQuery = associationQuery.substring(0,associationQuery.length - 1); // remove final comma
    query += " ON CONFLICT DO NOTHING;"
    associationQuery += " ON CONFLICT DO NOTHING;"
    console.log(query);
    console.log(associationQuery);

    db.oneOrNone(query)
        .then(async data => {
            db.oneOrNone(associationQuery)
                .then(async data => {
                    res.redirect('/wishlist');
                })
                .catch(err => {
                    console.log(err);
                    res.redirect('/wishlist');
                });
        })
        .catch(err => {
            console.log(err);
            res.redirect('/wishlist');
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

// SEARCH BOOKS PAGE
app.get('/searchBooks', async(req, res) => {
    //res.render('Pages/searchBooks');
    const bookSearch = 'flowers'; //for testing
    //console.log("search: ", req.body);
    
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
            console.log(results.data.items[0].volumeInfo);
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
        console.log(results.data.items[0].volumeInfo);
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
app.post('/searchBooks/add', async(req, res) => {
    console.log('book ID to add: ', req.body.book_title)
    const bookSearch = req.body.beanin;

    const query = 'INSERT INTO books(ISBN, name) VALUES($1, $2);';
    db.none(query, [
        req.body.book_ISBN,
        req.body.book_title
    ])
    .then(() => {console.log('added success')})
    .catch(err => {console.log('failed to add')})

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
        res.render('pages/searchBooks', {
            results: results.data.items,
            message: `Successfully added book`
        })
    })
    .catch(err => {
        res.render('pages/searchBooks', {
        results: [],
        error: true,
        message: `Sorry, something went wrong`
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
