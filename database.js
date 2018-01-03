const fetch = require("node-fetch");
const PG = require("pg");
const client = new PG.Client({
 connectionString: process.env.DATABASE_URL,
 ssl: true,
});

function fakeTest(number) {
  return number + 1
}

function getCurrentActivities() {
  client.connect();
  return client.query("SELECT * FROM activities WHERE status = TRUE");
}

module.exports = {
  fakeTest: fakeTest,
  getCurrentActivities: getCurrentActivities
}
