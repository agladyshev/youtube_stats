const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const assert = require('assert');
const moment = require('moment');
const request = require('request');
require('dotenv').config();

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
      const uri = account.youtube_id ?
        `https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&id=${account.youtube_id}&key=${process.env.API_KEY}` :
        `https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&forUsername=${account.youtube_name}&key=${process.env.API_KEY}`

      request(uri, function (error, response, body) {

        if ((body === undefined) || (body === null)) {
          const youtube_status = "Name error";
          account = Object.assign(account, {youtube_status});
          updateProfile(account);
          return
        }
        const results = JSON.parse(body)

        if (!results.pageInfo.totalResults) {
          const youtube_status = "Not Found";
          account = Object.assign(account, {youtube_status});
          updateProfile(account);
          return
        }

        const { id: youtube_id } = results.items[0]

        const {
          viewCount: youtube_views,
          commentCount: youtube_comments,
          subscriberCount: youtube_subscribers,
          videoCount: youtube_videos,
        } = results.items[0].statistics;

        const {
          title: youtube_name,
          description: youtube_description,
          thumbnails: thumbnails,
        } = results.items[0].snippet;

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
  // Update youtube stats in database
  try {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true });
    const db = client.db(process.env.DB_NAME);
    const col = db.collection('influencers');
    col.updateOne(
      { _id: account._id }
      , {
        $set: {
          youtube_id: account.youtube_id,
          youtube_name: account.youtube_name,
          youtube_description: account.youtube_description,
          youtube_views: account.youtube_views,
          youtube_subscribers: account.youtube_subscribers,
          youtube_videos: account.youtube_videos,
          youtube_thumbnail: account.youtube_thumbnail,
          youtube_thumbnail_med: account.youtube_thumbnail_med,
          youtube_thumbnail_high: account.youtube_thumbnail_high,
          youtube_status: account.youtube_status,
          youtube_updated: Date.now(),
        },
      }, function(err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
    });
    client.close();
  } catch (e) {
    console.error(e);
  }
};

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
});

app.listen(3000, () => console.log('Example app listening on port 3000!'));
