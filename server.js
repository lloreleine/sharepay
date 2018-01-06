const fetch = require("node-fetch");
const express = require("express");
const nunjucks = require("nunjucks");
const app = express();
const database = require("./database.js");
const port = process.env.PORT || 3000;
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const FB = require("fb");

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

//Registration
app.get("/register", function(request, result) {
  result.render("register");
});

app.post("/register", function(request, result) {
  database.register(request.body,request,result);
});

passport.use(
  new LocalStrategy(function(email, password, callback) {
    database.findUser(email, password, callback)
  })
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "https://morning-river-76119.herokuapp.com/auth/facebook/callback",
      profileFields: ['id', 'displayName', 'email']
    },
    function(accessToken, refreshToken, profile, callback) {
      return database.findOrCreateUser(profile, callback)
    }
  )
);

//Login system
passport.serializeUser(function(user, callback) {
  return callback(null, user.id);
});

passport.deserializeUser(function(id, callback) {
  return database.findUserById(id).then(user => {
    callback(null, user);
  });
});

app.get("/login", function(request, result) {
  result.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/login" }),
  function(request, result) {
    result.redirect(`/dashboard/${request.user.id}`);
  }
);

app.get("/logout", function(request, result) {
  request.logout();
  result.redirect("/login");
});

app.get(
  "/profile",
  require("connect-ensure-login").ensureLoggedIn(),
  function(request, result) {
    result.render("profile", {
      id: request.user.id,
      name: request.user.name,
      emails: request.user.emails
    });
});

app.get("/", function(request, result) {
  result.redirect("/login");
});

app.get(
  "/auth/facebook",
  passport.authenticate("facebook", {
    authType: "rerequest", // rerequest is here to ask again if login was denied once,
    scope: ["email"]
  })
);

app.get(
  "/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function(request, result) {
    result.redirect(`/dashboard/${request.user.id}`);
  }
);

//Sharepay
app.get("/view_activity/:id", function(request, result) {
  database.viewActivity(request.params.id, request,result)
});

app.get("/history", function(request, result) {
  database.getPastActivities(request.user.id)
  .then((activities) => activities.rows)
  .then(function(activities) {
    return result.render("history", {
     activities : activities,
     id :request.user.id
    })
  })
});

app.get("/dashboard/:id",
  require("connect-ensure-login").ensureLoggedIn("/login"),
  function(request, result) {
    database.getCurrentActivities(request.params.id)
    .then((activities) => activities.rows)
    .then(function(activities) {
      return result.render("dashboard", {
       activities : activities,
       date : database.formatDate(activities.map(activities => activities.date))
      })
  })
});

app.get("/balance/:id", function(request, result) {
  database.getBalance(request.params.id,result,request)
});

app.get("/finalize_activity/:id", function(request, result) {
  database.finalizeActivity(request.params.id)
  .then(function(activities) {
    return result.redirect(`/dashboard/${request.user.id}`)
  })
});

app.get("/addexpense/:id", function(request, result) {
  database.viewExpense(request.params.id, request, result)
});

app.get("/addactivity", function(request, result) {
  database.getActivity(request, result)
});

app.post("/addexpense/new/:id", function(request, result) {
  console.log(`request.body.expense_cost : ${request.body.expense_cost}`);
  database.addNewExpense(request.params.id, request.body, request, result)
  .then(function(expense) {
    return result.redirect(`/view_activity/${request.params.id}`)
  })
});

app.post("/addactivity/new", function(request, result) {
  database.addActivity(request.body, request, result)
  .then(function(activity) {
    return result.redirect(`/dashboard/${request.user.id}`)
  })
});

app.get("/editexpense/:id", function(request, result) {
  require("connect-ensure-login").ensureLoggedIn("/login"),
  database.editExpense(request.params.id, request,result)
});

app.get("/reopen_activity/:id", function(request, result) {
  database.reopenActivity(request.params.id)
  .then(function(activities) {
    return result.redirect(`/dashboard/${request.user.id}`)
  })
});

app.get("/updateactivity/:id", function(request, result) {
  database.displayActivity(request.params.id, request, result)
});

app.post("/updateact/:id", function(request, result) {
  database.updateAct(request.params.id, request.body, request, result)
  .then(function(update) {
    return result.redirect(`/updateactivity/${request.params.id}`)
  })
});

app.post("/updateparticipants/:id", function(request, result) {
  database.updateParticipants(request.params.id, request.body, request, result)
  .then(function(update) {
    return result.redirect(`/updateactivity/${request.params.id}`)
  })
});

app.listen(port, function(){
  console.log("Server listening on port:"+ port);
});
