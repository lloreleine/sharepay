const fetch = require("node-fetch");
const express = require("express");
const nunjucks = require("nunjucks");
const app = express();
const database = require("./database.js");

const port = process.env.PORT || 3000;

nunjucks.configure("views", {
  autoescape:true,
  express:app
});

app.use(express.static('./public/'));
app.use(require("body-parser").urlencoded({ extended: true }));

app.set("views", __dirname + "/views");
app.set("view engine", "njk");

app.get("/view_activity", function(request, result) {
  result.render("view_activity");
});

app.listen(port, function () {
  console.log("Server listening on port:" + port);
});

app.get("/", function(request, result) {
  database.getCurrentActivities()
  .then((activities) => activities.rows)
  // .then((activities) => console.log(activities))
  .then(function(activities) {
    return result.render("dashboard", {
     activities : activities
    })
  })
})
