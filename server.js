const PG = require("pg");
const fetch = require("node-fetch");

const express = require("express");
const nunjucks = require("nunjucks");
const app = express();

const port = process.env.PORT || 3000;

nunjucks.configure("views", {
  autoescape:true,
  express:app
});

app.use(express.static('./images/'));
app.use(require("body-parser").urlencoded({ extended: true }));

app.set("views", __dirname + "/views");
app.set("view engine", "njk");

app.listen(port, function () {
  console.log("Server listening on port:" + port);
});

app.get("/", function(request, result) {
  result.render("dashboard")
});
