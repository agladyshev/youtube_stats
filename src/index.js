const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const assert = require('assert');
const moment = require('moment');
const unirest = require('unirest');
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
  accounts.forEach((account) => {
    try {
      const uri = account.twitter_id ?
        `https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&id=${account.youtube_id}&key=${process.env.API_KEY}` :
        `https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&forUsername=${account.youtube_name}&key=${process.env.API_KEY}`
     
      unirest.get(uri)
        .end(function (response) {
          const body = response.body

          if ((body === undefined) || (body === null)) {
            const youtube_status = "Name error";
            account = Object.assign(account, {youtube_status});
            updateProfile(account);
            return
          }

          if (!body.pageInfo.totalResults) {
            const youtube_status = "Not Found";
            account = Object.assign(account, {youtube_status});
            updateProfile(account);
            return
          }

          const { id: youtube_id } = body.items[0]

          const {
            viewCount: youtube_views,
            commentCount: youtube_comments,
            subscriberCount: youtube_subscribers,
            videoCount: youtube_videos,
          } = body.items[0].statistics;

          const {
            title: youtube_name,
            description: youtube_description,
            thumbnails: thumbnails,
          } = body.items[0].snippet;

          const youtube_thumbnail = thumbnails.default.url;
          const youtube_thumbnail_med = thumbnails.medium.url;
          const youtube_thumbnail_high = thumbnails.high.url;

          const youtube_status = 'OK';

          account = Object.assign(account, {
            youtube_id,
            youtube_name,
            youtube_description,
            youtube_views,
            youtube_comments,
            youtube_subscribers,
            youtube_videos,
            youtube_thumbnail,
            youtube_thumbnail_med,
            youtube_thumbnail_high,
            youtube_status,
          });

          updateProfile(account);
         
        });
    } catch (e) {
      console.error(e);
    }
  });
};

const updateProfile = async (account) => {
  console.log(account);
  // Update youtube stats in database
  // try {
  //   const client = await MongoClient.connect(uri, { useNewUrlParser: true });
  //   const db = client.db(process.env.DB_NAME);
  //   const col = db.collection('influencers');
  //   col.updateOne(
  //     { _id: account._id }
  //     , {
  //       $set: {
  //         youtube_id: account.youtube_id,
  //         youtube_name: account.youtube_name,
  //         youtube_followers: account.youtube_followers,
  //         tweets: account.tweets,
  //         youtube_pic: account.youtube_pic,
  //         youtube_status: account.youtube_status,
  //         youtube_updated: Date.now(),
  //       }
  //     }, function(err, result) {
  //       assert.equal(err, null);
  //       assert.equal(1, result.result.n);
  //   });
  //   client.close();
  // } catch (e) {
  //   console.error(e);
  // }
};

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
