// require mongoose and setup the Schema
require("dotenv").config();
var mongoose = require("mongoose");
var Schema = mongoose.Schema;
// require bcrypt to hash passwords
const bcrypt = require("bcryptjs");

const transactionSchema = new Schema({
  date: {
    type: Date,
    required: true,
  },
  merchant_code: {
    type: String,
    required: true,
  },
  amount_cents: {
    type: Number,
    required: true,
  },
});

//var Transaction = mongoose.model("transactions", transactionSchema);

// define the user schema
var userSchema = new Schema({
  userName: {
    type: String,
    unique: true,
  },
  password: String,
  email: String,
  loginHistory: {
    dateTime: Date,
    userAgent: String,
  },
});

var rewardSchema = new Schema({
  name: String,
  amount: Number,
});

let Reward;
let User;
let Transaction;

module.exports.initialize = (connectionString) => {
  return new Promise((resolve, reject) => {
    let db = mongoose.createConnection(connectionString);

    db.on("error", (err) => {
      reject(err); // reject the promise with the provided error
    });
    db.once("open", () => {
      User = db.model("users", userSchema);
      Transaction = db.model("transactions", transactionSchema);
      Reward = db.model("reward", rewardSchema);
      resolve();
    });
  });
};

module.exports.getAllTransactions = () => {
  return new Promise((resolve, reject) => {
    Transaction.find()
      .then((data) => {
        resolve(data);
      })
      .catch(() => {
        reject("no results returned.");
      });
  });
};
let rewards = 0;

module.exports.getRewards = () => {
  return new Promise((resolve, reject) => {
    Transaction.find({}).exec(function (err, docs) {
      var sportchek = 0;
      var tim_hortons = 0;
      var subway = 0;
      var other = 0;
      rewards = 0;

      docs.forEach(function (doc) {
        if (doc.merchant_code == "sportchek") {
          sportchek += doc.amount_cents;
        } else if (doc.merchant_code == "tim_hortons") {
          tim_hortons += doc.amount_cents;
        } else if (doc.merchant_code == "subway") {
          subway += doc.amount_cents;
        } else if (doc.merchant_code == "other") {
          other += doc.amount_cents;
        }
      });

      while (sportchek >= 1 || tim_hortons >= 1 || subway >= 1 || other >= 1) {
        if (sportchek > 75 && tim_hortons > 25 && subway > 25) {
          sportchek -= 75;
          tim_hortons -= 25;
          subway -= 25;
          rewards += 500;
        } else if (sportchek > 75 && tim_hortons > 25) {
          sportchek -= 75;
          tim_hortons -= 25;
          rewards += 300;
        } else if (sportchek > 75) {
          sportchek -= 75;
          rewards += 200;
        } else if (sportchek > 25 && tim_hortons > 10 && subway > 10) {
          sportchek -= 25;
          tim_hortons -= 10;
          subway -= 10;
          rewards += 150;
        } else if (sportchek > 25 && tim_hortons > 10) {
          sportchek -= 25;
          tim_hortons -= 10;
          rewards += 75;
        } else if (sportchek > 20) {
          sportchek -= 20;
          rewards += 75;
        } else {
          while (
            sportchek >= 1 ||
            tim_hortons >= 1 ||
            subway >= 1 ||
            other >= 1
          ) {
            if (sportchek >= 1) {
              sportchek -= 1;
              rewards += 1;
            }
            if (tim_hortons >= 1) {
              tim_hortons -= 1;
              rewards += 1;
            }
            if (subway >= 1) {
              subway -= 1;
              rewards += 1;
            }
            if (other >= 1) {
              other -= 1;
              rewards += 1;
            }
          }
        }
      }

      Reward.updateOne({ name: "reward1" }, { $set: { amount: rewards } })
        .exec()
        .then()
        .catch(() => {
          reject("There was an error encrypting the password");
        });

      Reward.findOne({ name: "reward1" })
      .exec()
      .then((data) => { resolve(data)});
    });
  });
};

module.exports.addTransaction = (transactionData) => {
  return new Promise((resolve, reject) => {
    let newTransaction = new Transaction(transactionData);
    newTransaction.save((err) => {
      if (err) {
        if (err.code) {
          reject("Error");
        } else {
          reject("There was an error creating the transaction: " + err);
        }
      } else {
        resolve();
      }
    });
  });
};

module.exports.registerUser = (userData) => {
  return new Promise((resolve, reject) => {
    if (userData.password != userData.password2) {
      reject("Passwords do not match");
    } else {
      // create a new user
      bcrypt
        .genSalt(10) // Generate a "salt" using 10 rounds
        .then((salt) => bcrypt.hash(userData.password, salt)) // encrypt the password: "myPassword123"
        .then((hash) => {
          // TODO: Store the resulting "hash" value in the DB
          userData.password = hash;
          let newUser = new User(userData);

          // save the new user
          newUser.save((err) => {
            if (err) {
              if (err.code) {
                reject("User Name already taken");
              } else {
                reject("There was an error creating the user: " + err);
              }
            } else {
              resolve();
            }
          });
        })
        .catch(() => {
          reject("There was an error encrypting the password");
        });
    }
  });
};

module.exports.checkUser = (userData) => {
  return new Promise((resolve, reject) => {
    User.find({ userName: userData.userName })
      .exec()
      .then((users) => {
        if (users.length == 0) {
          reject("Unable to find user: " + userData.userName);
        } else {
          bcrypt
            .compare(userData.password, users[0].password)
            .then((result) => {
              if (result) {
                users[0].loginHistory = {
                  dateTime: new Date().toString(),
                  userAgent: userData.userAgent,
                };
              } else {
                reject("Incorrect Password for user: " + userData.userName);
              }
            });

          User.updateOne(
            { userName: users[0].userName },
            { $set: { loginHistory: users[0].loginHistory } }
          )
            .exec()
            .then(() => {
              resolve(users[0]);
            })
            .catch((err) => {
              reject("There was an error verifying the user: " + err);
            });
        }
      })
      .catch(() => {
        reject("Unable to find user: " + userData.userName);
      });
  });
};
