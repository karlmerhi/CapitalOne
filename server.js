const express = require("express");
const app = express();
const exphbs = require("express-handlebars");
const bcrypt = require("bcryptjs");
const clientSessions = require("client-sessions");
require("dotenv").config(({path:__dirname+'/process.env'}));
var path = require("path");
const dataServiceAuth = require("./data-service-auth.js");
var currentTime = new Date().toISOString().slice(0, 10);

var HTTP_PORT = process.env.PORT || 8080;

// Setup client-sessions
app.use(clientSessions({
    cookieName: "session", // this is the object name that will be added to 'req'
    secret: process.env.SECRET, // this should be a long un-guessable string.
    duration: 10 * 60 * 1000, // duration of the session in milliseconds 
    activeDuration: 10 * 1000 * 60 // the session will be extended by this many ms each request (1 minute)
  }));

app.engine(
    ".hbs",
    exphbs.engine({
      extname: ".hbs",
      defaultLayout: "main",
      runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
      },
      helpers: {
        navLink: function (url, options) {
          return (
            "<li" +
            (url == app.locals.activeRoute ? ' class="active" ' : "") +
            '><a href="' +
            url +
            '">' +
            options.fn(this) +
            "</a></li>"
          );
        },
    }
    })
);

app.set("view engine", ".hbs");

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
  });

  app.use((req, res, next) => {
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = route == "/" ? "/" : route.replace(/\/$/, "");
    next();
  });


app.use(express.static("public")); //to recognize the css files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
  });

function ensureLogin(req, res, next) {
    if (!req.session.user) {
      res.redirect("/login");
    } else {
      next();
    }
  }

app.get("/", (req, res) => {
    if(req.session.user)
        res.redirect("/login");
    else
        res.redirect("/dashboard");
  });

  app.get("/login", function(req, res) {
    res.render("login", {login: true});
  });

  app.get("/register", function(req, res) {
    res.render("register", {register: true});
  });

  app.post("/login", (req, res) => {
    dataServiceAuth
    .checkUser(req.body)
    .then((user) => {
      req.session.user = {
        username: user.username,
        password: user.password,
      };
  
      res.redirect("/dashboard");
    }).catch((err) => {
      res.render("login", { login: true, message: "invalid username or password!"});
    })
  });

  let temp;

  app.get("/dashboard", ensureLogin, (req, res) => {
    dataServiceAuth
    .getAllTransactions()
    .then((data) => {
        temp = data;
    })
    .catch((err) => {
      res.render("dashboard", { message: err });
    });
    dataServiceAuth.getRewards().then((rewards) => {
        res.render("dashboard", { transaction: temp , reward: rewards});
    }).catch((err) => {
        res.render("dashboard", { message: err });
      });
  });

  app.get("/addTransaction", ensureLogin, (req, res) => {
    res.render("addTransaction", {user: req.session.user, date: currentTime});
  });

  app.post("/addTransaction", ensureLogin, (req, res) => {
    dataServiceAuth
    .addTransaction(req.body)
    .then(() => {
      res.redirect("dashboard");
    })
    .catch((err) => {
        console.log(err);
      res.render("dashboard",{ message: "Unable to add, an error has occured" });// { transaction: [] });
    });
  });

  app.post("/register", (req, res) => {
    dataServiceAuth
      .registerUser(req.body)
      .then(() => {
        res.render("register", { successMessage: "User created" });
      })
      .catch((err) => {
        res.render(
          "register",
          res.render("register", {
            errorMessage: err,
            userName: req.body.userName,
          })
        );
      });
  });

  
  // Log a user out by destroying their session
  // and redirecting them to /login
  app.get("/logout", function(req, res) {
    req.session.reset();
    res.redirect("/login");
  });

  dataServiceAuth.initialize(process.env.MONGODB_CONN_STRING).then(()=>{
    app.listen(HTTP_PORT, ()=>{
        console.log(`server listening on: ${HTTP_PORT}`);
    }); 
}).catch((err)=>{     
    console.log(err); 
});
