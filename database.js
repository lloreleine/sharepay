const fetch = require("node-fetch");
const PG = require("pg");
const sha256 = require('js-sha256').sha256;

function fakeTest(number) {
  return number + 1
}


function findUser(email, password) {
  const client = new PG.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});
  const hash=sha256(password);
  client.connect();
  return client.query(
    "SELECT * from users WHERE name=$1 and password=$2",
    [email,hash]).then(res => {
    client.end();
    return res.rows[0];
    })
}

function findUserById(id) {
  const client = new PG.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});
  client.connect();
  return client.query(
    "SELECT * from users WHERE id=$1",
    [id]).then(res => {
      client.end();
      return res.rows[0];
    })
}

function register(user,request,result) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  const hash=sha256(user.password);
  client.connect();
  client.query("INSERT INTO users (id,name, password) VALUES (uuid_generate_v4(),$1,$2) RETURNING *", [user.username, hash])
    .then(res => {
      request.logIn(res.rows[0], function(error) {
        if (error) {
          return result.redirect("/register");
        }
        else {
        return result.redirect(`/dashboard/${res.rows[0].id}`);}
      });
    })
    .catch(error => {
      console.warn(error);
    });
}

function getCurrentActivities(id) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  return client.query("SELECT * FROM activities inner join users_activities on user_id=$1 and activity_id=id WHERE status = TRUE",[id]);
}

function getPastActivities(id) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  return client.query("SELECT * FROM activities inner join users_activities on user_id=$1 and activity_id=id WHERE status = FALSE",[id]);
}

function viewActivity(activityId, request,result) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  client.query(
    "SELECT title,amount,name, COUNT(users_expenses.user_id) FROM expenses INNER JOIN users ON users.id=expenses.buyer_id INNER JOIN users_expenses ON expense_id=expenses.id WHERE activity_id=$1::uuid GROUP BY title,amount,name;",
    [activityId],
    function(error, result1){
      if(error){
        console.warn(error);
      }
      client.query(
        "select SUM(amount),users.name,activities.title from expenses inner join users on users.id=expenses.buyer_id inner join activities on activities.id=activity_id WHERE activity_id=$1::uuid GROUP BY users.id,activities.title;",
        [activityId],
        function(error, result2){
          if(error){
            console.warn(error);
          }
          client.query(
            "select SUM(amount) from expenses WHERE activity_id=$1::uuid;",
            [activityId],
            function(error, result3){
              if(error){
                console.warn(error);
              }
              result.render("view_activity", {
                expenses : result1.rows,
                amounts_sum : result2.rows,
                total : result3.rows,
                activityId : activityId,
                userid :request.user.id
              });
              client.end();
            }
          );
        }
      );
    }
  );
}

function finalizeActivity(activityId) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  return client.query("UPDATE activities SET status=FALSE WHERE id=$1::uuid",[activityId])
    .then(res => client.end())
}

function reopenActivity(activityId) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  return client.query("UPDATE activities SET status=TRUE WHERE id=$1::uuid",[activityId])
    .then(res => client.end())
}

function viewExpense(activityId, result) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  client.query(
    "SELECT name, users.id FROM expenses INNER JOIN users ON users.id=expenses.buyer_id WHERE activity_id=$1::uuid GROUP BY name, users.id;",
    [activityId],
    function(error, result1){
      if(error){
        console.warn(error);
      }
      result.render("addexpense", {
        expenses:result1.rows,
        activityId:activityId
      });
      client.end();
    }
  );
}

function addNewExpense(activityId, expense, request, result) {
  console.log("TOTO");
  console.log(activityId);
  console.log(expense.expense_descr);
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  return client.query("INSERT INTO expenses (id, title, amount, activity_id, buyer_id) VALUES (uuid_generate_v4(),$1,$2,$3,(SELECT id FROM users WHERE name=$4)) RETURNING *", [expense.expense_descr, expense.expense_cost, activityId, expense.expense_buyer])
    .then(res => {
      let arrayBenefits = "";
      console.log(expense);

      for(i=0; i<expense.benefits.length; i++){
        if(i===(expense.benefits.length-1)){
          console.log("entré dans le if");
          arrayBenefits = arrayBenefits+`('${res.rows[0].id}','${expense.benefits[i]}')`;
        }else{
          arrayBenefits = arrayBenefits+`('${res.rows[0].id}','${expense.benefits[i]}'),`;
        }
      }
      console.log(arrayBenefits);
      client.query("INSERT INTO users_expenses (expense_id, user_id) VALUES " + arrayBenefits)
      .then(_res => {
        client.end()
      })
      .catch(error => console.warn(error))
    })
}

module.exports = {
  fakeTest: fakeTest,
  getCurrentActivities: getCurrentActivities,
  viewActivity: viewActivity,
  getPastActivities: getPastActivities,
  register:register,
  findUserById:findUserById,
  findUser:findUser,
  finalizeActivity: finalizeActivity,
  reopenActivity: reopenActivity,
  viewExpense:viewExpense,
  addNewExpense:addNewExpense
}
