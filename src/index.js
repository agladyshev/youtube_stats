const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const assert = require('assert');
const moment = require('moment');
require('dotenv').config();

// const client = new Youtube({
//   consumer_key: process.env.YOUTUBE_CONSUMER_KEY,
//   consumer_secret: process.env.YOUTUBE_CONSUMER_SECRET,
//   access_token_key: process.env.YOUTUBE_ACCESS_TOKEN_KEY,
//   access_token_secret: process.env.YOUTUBE_ACCESS_TOKEN_SECRET,
// });

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;

const getYoutubeAccounts = async () => {
  // Collect a list of influencers with youtube accounts
  let accounts;
  try {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true });

    const db = client.db(process.env.DB_NAME);

    const col = db.collection('influencers');

    accounts = await col.find({ $or: [{ youtube_name: { $gt: '' } }, { youtube_id: { $gt: '' } }] }).project({ youtube_name: 1, youtube_id: 1 }).toArray();

    client.close();
  } catch (e) {
    console.error(e);
  }
  return accounts;
};

const getYoutubeProfile = async () => {
  // Call youtube for updated profile information
  const accounts = await getYoutubeAccounts();
  console.log(accounts);
  // accounts.forEach((account) => {
  //   try {
  //     const uri = account.youtube_id ? 
  //     `https://api.youtube.com/1.1/users/show.json?user_id=${account.youtube_id}` :
  //     `https://api.youtube.com/1.1/users/show.json?screen_name=${account.youtube_name}`;
  //     client.get(uri, function (error, body, response) {
  //       const {
  //         id_str: youtube_id,
  //         screen_name: youtube_name,
  //         followers_count: youtube_followers,
  //         statuses_count: tweets,
  //         profile_image_url: youtube_pic,
  //       } = body;
  //       if (error) {
  //         const youtube_status = error[0].message;
  //         account = Object.assign(account, {youtube_status});
  //       } else {
  //         const youtube_status = 'OK';
  //         account = Object.assign(account, {
  //           youtube_id, youtube_name, youtube_followers, tweets, youtube_pic, youtube_status});
  //       }
  //       updateProfile(account);
  //     });
  //   } catch (e) {
  //     console.error(e);
  //   }
  // });
};

// const updateProfile = async (account) => {
//   // Update youtube stats in database
//   try {
//     const client = await MongoClient.connect(uri, { useNewUrlParser: true });
//     const db = client.db(process.env.DB_NAME);
//     const col = db.collection('influencers');
//     col.updateOne(
//       { _id: account._id }
//       , {
//         $set: {
//           youtube_id: account.youtube_id,
//           youtube_name: account.youtube_name,
//           youtube_followers: account.youtube_followers,
//           tweets: account.tweets,
//           youtube_pic: account.youtube_pic,
//           youtube_status: account.youtube_status,
//           youtube_updated: Date.now(),
//         }
//       }, function(err, result) {
//         assert.equal(err, null);
//         assert.equal(1, result.result.n);
//     });
//     client.close();
//   } catch (e) {
//     console.error(e);
//   }
// };

// const getTweetStats = async () => {
//   // Call youtube for user tweets
//   const accounts = await getYoutubeAccounts();
//   accounts.forEach((account) => {
//     try {
//       client.get(
//         `https://api.youtube.com/1.1/statuses/user_timeline.json?user_id=${account.youtube_id}&trim_user=true&exclude_replies=true&include_rts=false`,
//         function (error, tweets, response) {

//         const youtube_stats = tweets.reduce(function(accumulator, tweet, index) {
//           // Filter tweets with a selected period of time
//           if (moment(tweet.created_at, 'dd MMM DD HH:mm:ss ZZ YYYY', 'en')
//             .isAfter(moment().subtract(process.env.STATS_SINCE_DAYS, 'days'))) {
//             accumulator.retweets_recent = accumulator.retweets_recent + tweet.retweet_count;
//             accumulator.favorites_recent = accumulator.favorites_recent + tweet.favorite_count;
//             accumulator.tweets_recent += 1;
//           }
//           return accumulator;
//         }, {retweets_recent: 0, favorites_recent: 0, tweets_recent: 0});
//         if (error) {
//           const youtube_status = error[0].message;
//           account = Object.assign(account, {youtube_status});
//         } else {
//           const youtube_status = 'OK';
//           account = Object.assign(account, youtube_stats, {youtube_cycle: process.env.STATS_SINCE_DAYS});
//         }
//         updateTweetStats(account);
//       });
//     } catch (e) {
//       console.error(e);
//     }
//   });
// };

// const updateTweetStats = async (account) => {
//   // Update tweets stats in the database
//   try {
//     const client = await MongoClient.connect(uri, { useNewUrlParser: true });
//     const db = client.db(process.env.DB_NAME);
//     const col = db.collection('influencers');
//     col.updateOne(
//       { _id: account._id }
//       , {
//         $set: {
//           youtube_retweets_recent: account.retweets_recent,
//           youtube_favorites_recent: account.favorites_recent,
//           tweets_recent: account.tweets_recent,
//           youtube_cycle: account.youtube_cycle,
//           youtube_status: account.youtube_status,
//           tweets_updated: Date.now(),
//         }
//       }, function(err, result) {
//         assert.equal(err, null);
//         assert.equal(1, result.result.n);
//     });
//     client.close();
//   } catch (e) {
//     console.error(e);
//   }
// };

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('expires', '0');
  res.setHeader('pragma', 'no-cache');
  next();
});

app.get('/', (req, res) => {
  getYoutubeProfile();

  // getYoutubeProfile();
  // getTweetStats();
});

// app.get('/tweets', (req, res) => getTweetStats());
// app.get('/profiles', (req, res) => getYoutubeProfile());

app.listen(3000, () => console.log('Example app listening on port 3000!'));
