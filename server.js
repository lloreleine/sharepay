const fetch = require("node-fetch");
const express = require("express");
const nunjucks = require("nunjucks");
const app = express();
const database = require("./database.js");
const port = process.env.PORT || 3000;
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

nunjucks.configure("views", {
  autoescape:true,
  express:app
});

app.use(express.static('./public/'));
app.use(require("body-parser").urlencoded({ extended: true }));

app.set("views", __dirname + "/views");
app.set("view engine", "njk");

app.use(require("body-parser").urlencoded({ extended: true }));
app.use(require("cookie-parser")());
app.use(
  require("express-session")({
    secret: "i4ms3cre7",
    resave: false,
    saveUninitialized: false
  })
);

// Initialize Passport and restore authentication state,
// if any, from the session.
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, callback) {
  return callback(null, user.id);
});

passport.deserializeUser(function(id, callback) {
  return database.findUserById(id).then(user => {
    callback(null, user);
  });
});

passport.use(
  new LocalStrategy(function(email, password, callback) {
    database.findUser(email, password)
      .then(user => {
        callback(null, user);
      })
      .catch(error => {
        callback(error);
      });
  })
);

app.get("/register", function(request, result) {
  result.render("register");
});

app.get("/login", function(request, result) {
  result.render("login");
});

app.get("/view_activity/:id", function(request, result) {
  database.viewActivity(request.params.id, request,result)
});

app.get("/history", function(request, result) {
  database.getPastActivities()
  .then((activities) => activities.rows)
  .then(function(activities) {
    return result.render("history", {
     activities : activities,
     id :request.user.id
    })
  })
});

app.get("/dashboard/:id", function(request, result) {
  require("connect-ensure-login").ensureLoggedIn("/login"),
  database.getCurrentActivities(request.params.id)
  .then((activities) => activities.rows)
  .then(function(activities) {
    return result.render("dashboard", {
     activities : activities
    })
  })
});

app.get("/balance/:id", function(request, result) {
  result.render("balance")
});

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/login" }),
  function(request, result) {
    result.redirect(`/dashboard/${request.user.id}`);
  }
);

app.post("/register", function(request, result) {
  database.register(request.body,request,result);
});

app.get("/logout", function(request, result) {
  request.logout();
  result.redirect("/login");
});

app.listen(port, function(){
  console.log("Server listening on port:"+ port);
});
