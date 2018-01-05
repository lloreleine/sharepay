const fetch = require("node-fetch");
const PG = require("pg");
const sha256 = require('js-sha256').sha256;
const { createTransaction, payback } = require('./payback');
const { Pool } = require("pg");
const pool = new Pool();


function fakeTest(number) {
  return number + 1
}

function findUser(email, password, callback) {
  const client = new PG.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
  });
  const hash=sha256(password);
  client.connect();
  return client.query(
    "SELECT * from users WHERE email=$1 and password=$2",
    [email,hash])
    .then(res => {
      client.end();
      if (res.rows.length === 0) {
        callback("User does not exist");
      }

      callback(null, res.rows[0]);
    })
    .catch(error => {
      callback(error);
    });
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
  client.query("INSERT INTO users (id, name, email, password) VALUES (uuid_generate_v4(),$1,$2,$3) RETURNING *", [user.username, user.email, hash])
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
              console.log(result2.rows);
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

function findOrCreateUser(profile, callback) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  return client.query("SELECT * from users WHERE email=$1", [profile._json.email])
  .then(res => {
    if (res.rows.length === 0) {
      return client.query("INSERT INTO users (id, name, email) VALUES (uuid_generate_v4(),$1,$2) RETURNING *",[profile._json.name, profile._json.email])
      .then(result => {
        callback(null, result.rows[0]);
      })
      .catch(error => {
        callback(error);
      })
    }
    callback(null, res.rows[0]);
  })
  .catch(error => console.warn(error))
}

function viewExpense(activityId, result) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  client.query(
    // "SELECT name, users.id FROM expenses INNER JOIN users ON users.id=expenses.buyer_id WHERE activity_id=$1::uuid GROUP BY name, users.id;",
    "SELECT name, users.id FROM users_activities INNER JOIN users ON users.id=user_id WHERE activity_id=$1::uuid GROUP BY name, users.id;",
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

function getActivity(request, result) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  client.query(
    "SELECT name, users.id FROM users;",
    [],
    function(error, result1){
      if(error){
        console.warn(error);
      }
      result.render("addactivity", {
        users:result1.rows,
        current:request.user.id
      });
      client.end();
    }
  );
}

function addActivity(activity,request, result) {
  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  return client.query("INSERT INTO activities (id, title, status,location, date) VALUES (uuid_generate_v4(),$1,TRUE,$2,$3) RETURNING *", [activity.activity_descr, activity.activity_loc,activity.activity_date])
    .then(res => {
      let arrayBenefits = "";
      for(i=0; i<activity.benefits.length; i++){
        if(i===(activity.benefits.length-1)){
          arrayBenefits = arrayBenefits+`('${activity.benefits[i]}','${res.rows[0].id}')`;
        }else{
          arrayBenefits = arrayBenefits+`('${activity.benefits[i]}','${res.rows[0].id}'),`;
        }
      }
      client.query("INSERT INTO users_activities (user_id, activity_id) VALUES " + arrayBenefits)
      .then(_res => {
        client.end()
      })
      .catch(error => console.warn(error))
    })
}

function getBalance(id,result) {
  const transactions=[];
  const userexpense=[];
  const fullusers=[];

  const client = new PG.Client({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
  });
  client.connect();
  client.query(
    "select buyer_id,amount,id from expenses WHERE activity_id=$1;",
    [id])
    .then(res => {
      let listexpense="(";
      console.log("toto" + res.rows[0].id);
      for(i=0; i<res.rows.length; i++){
        if(i===(res.rows.length-1)){
          listexpense = listexpense+`'${res.rows[i].id}')`;
        }else{
          listexpense = listexpense+`'${res.rows[i].id}',`;
        }
      }
      console.log(listexpense);
      client.query("Select expense_id, user_id from users_expenses where expense_id in"+ listexpense)
      .then(res2 => {
        client.end()
        console.log(res2.rows[0]);
        for(i=0; i<res.rows.length; i++){
        console.log(res.rows[i].buyer_id);
        console.log(res.rows[i].amount);
        const userexpense=[];
          for(j=0; j<res2.rows.length; j++){
            if (res2.rows[j].expense_id===res.rows[i].id) {
              userexpense.push(res2.rows[j].user_id);
            }
          }
        console.log(userexpense);
        transactions.push(createTransaction(res.rows[i].buyer_id,res.rows[i].amount,userexpense));
        }
        console.log(transactions);
        for(k=0; k<res2.rows.length; k++){
          if (fullusers.includes(res2.rows[k].user_id)) {
          }
          else {
            fullusers.push(res2.rows[k].user_id);
          }
        }
        console.log(fullusers);
        const board=payback(transactions, fullusers);
        console.log(board);
        console.log("toto");
        return result.render("balance", {
         board : board
        })
      })
      .catch(error => console.warn(error))
    });
}

  // const cinema = createTransaction('alice', 440, ['alice', 'bob', 'charlie', 'damian']);
  // //buyer/montant/beneficiaire
  // const food = createTransaction('bob', 450, ['bob', 'charlie', 'damian']);
  // const taxi = createTransaction('charlie', 100, ['charlie', 'alice']);
  // const drinks = createTransaction('damian', 150, ['damian', 'alice', 'bob']);
  // const rentDamian = createTransaction('damian', 200, ['alice', 'bob', 'charlie', 'damian']);
  // const rentCharlie = createTransaction('charlie', 400, ['alice', 'bob', 'charlie', 'damian']);
  // const transactions = [cinema, food, taxi, drinks, rentDamian, rentCharlie];
  //
  // payback(transactions, ['alice', 'bob', 'charlie', 'damian']);


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
  addNewExpense:addNewExpense,
  addActivity:addActivity,
  getActivity:getActivity,
  findOrCreateUser: findOrCreateUser,
  getBalance:getBalance
}
