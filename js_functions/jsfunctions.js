const PG = require("pg");

function viewActivity(activityId,result) {
  const client = new PG.Client({
    connectionString:process.env.DATABASE_URL,
    ssl:true,
  });
  client.connect();
  console.log("TOTO");
  client.query(
    "SELECT title,amount,name, COUNT(users_expenses.user_id) from expenses INNER JOIN users ON users.id=expenses.buyer_id INNER JOIN users_expenses ON expense_id=expenses.id WHERE activity_id=$1::uuid GROUP BY title,amount,name",
    [activityId],
    function(error, result1){
      if(error){
        console.warn(error);
      }
      console.log(result1.rows);
      result.render("view_activity", {
        expenses:result1.rows
      });
      client.end();
    }
  );
};

module.exports = {
  viewActivity:viewActivity,
};
