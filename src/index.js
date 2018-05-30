const express = require('express');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const Twitter = require('twitter');
require('dotenv').config();

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;

const getTwitterAccounts = async () => {
  // Collect a list of influencers with twitter accounts
  try {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true });

    console.log('Connected successfully to server');

    const db = client.db(process.env.DB_NAME);

    const col = db.collection('influencers');

    col.find({twitter_name: {$gt: ''}}).project({twitter_name:1, twitter_id:1}).toArray(function(err, accounts) {
      getTwitterStats(accounts);
    });
    client.close();
  } catch (e) {
    console.error(e);
  }
};

const getTwitterStats = async (accounts) => {
  accounts.forEach((account) => {
    try {
      client.get(`https://api.twitter.com/1.1/users/show.json?screen_name=${account.twitter_name}`, function (error, body, response) {
        const {
          id_str: twitter_id,
          screen_name: twitter_name,
          followers_count: twitter_followers,
          statuses_count: tweets,
          profile_image_url: twitter_pic,
        } = body;
        const twitter_status = error ? error[0].message : 'OK';
        account = Object.assign(account, {twitter_id, twitter_name, twitter_followers, tweets, twitter_pic, twitter_status});
        updateTwitterStats(account);
      });
    } catch (e) {
      console.error(e);
    }
  });
};

const updateTwitterStats = async (account) => {
  // Collect a list of influencers with twitter accounts
  try {
    console.log(account);
    // const client = await MongoClient.connect(uri, { useNewUrlParser: true });

    // console.log('Connected successfully to server');

    // const db = client.db(process.env.DB_NAME);

    // const col = db.collection('influencers');

    // // Update function

    // client.close();
  } catch (e) {
    console.error(e);
  }
};

// Update collection
// MongoClient.connect(uri, function(err, client) {
//   assert.equal(null, err);
//   console.log("Connected correctly to server");

//   const db = client.db(process.env.DB_NAME);

//   const col = db.collection('influencers');

//   col.updateOne({name:'test'}, {$set: {telegram_admin: 'super'}}, function(err, r) {
//     assert.equal(null, err);
//     assert.equal(1, r.matchedCount);
//     assert.equal(1, r.modifiedCount);
//   });
// });


const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('expires', '0');
  res.setHeader('pragma', 'no-cache');
  next();
});

app.get('/', (req, res) => getTwitterAccounts());
app.listen(3000, () => console.log('Example app listening on port 3000!'));
