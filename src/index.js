'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const assert = require('assert');
const moment = require('moment');
const request = require('request-promise-native');

require('dotenv').config();

const port = process.env.PORT || 3000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;

// YouTube API calls

const fetchYoutubeProfile = async (account) => {
  const uri = account.youtube_id ?
    `https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&id=${account.youtube_id}&key=${process.env.API_KEY}` :
    `https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&forUsername=${account.youtube_name}&key=${process.env.API_KEY}`

  await request(uri)
    .then(function (body) {
      if ((body === undefined) || (body === null)) {
        const youtube_status = "Name error";
        account = Object.assign(account, { youtube_status });
        return
      }
      const results = JSON.parse(body)

      if (!results.pageInfo.totalResults) {
        const youtube_status = "Not Found";
        account = Object.assign(account, { youtube_status });
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
    })
    .catch(function (err) {
      console.log(err);
    })
  return account;
}

const fetchVideos = async (account) => {
  // Fetch recent videos for account
  if (!account.youtube_id) {
    return account;
  }
  const since = moment().subtract(process.env.STATS_SINCE_DAYS, 'days').utc().format();
  await request(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${account.youtube_id}&order=date&type=video&publishedAfter=${since}&key=${process.env.API_KEY}`)
    .then(function (body) {
      const results = JSON.parse(body);
      account.videos = results.items;
    })
    .catch(function (err) {
      console.log(account);
      console.log(err);
    })
  return account;
};

const fetchVideoStats = async (video) => {
  // Call youtube for video statistics
  await request(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${video.id.videoId}&key=${process.env.API_KEY}`)
    .then(function (stats) {
      const statistics = JSON.parse(stats).items[0].statistics;
      video.statistics = statistics;
    })
    .catch(function (err) {
      console.log(err);
    });
  return video;
};

// MongoDB API calls

const getYoutubeAccounts = async (req, res, next) => {
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
  res.body = accounts;
  next();
};

const updateMongoProfile = async (account) => {
  // Update youtube profile info in database
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
      }, function (err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
      });
    client.close();
  } catch (e) {
    console.error(e);
  }
};

const updateMongoStats = async (account) => {
  // Update tweets stats in the database
  try {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true });
    const db = client.db(process.env.DB_NAME);
    const col = db.collection('influencers');
    const { views_recent,
      likes_recent,
      dislikes_recent,
      comments_recent,
      favorites_recent,
      videos_recent,
    } = account.statistics || {};
    col.updateOne(
      { _id: account._id }
      , {
        $set: {
          youtube_views_recent: views_recent,
          youtube_likes_recent: likes_recent,
          youtube_dislikes_recent: dislikes_recent,
          youtube_comments_recent: comments_recent,
          youtube_favorites_recent: favorites_recent,
          youtube_videos_recent: videos_recent,
          youtube_videos_status: account.youtube_videos_status,
          youtube_videos_cycle: process.env.STATS_SINCE_DAYS,
          youtube_videos_updated: Date.now(),
        }
      }, function(err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
    });
    client.close();
  } catch (e) {
    console.error(e);
  }
};

// Middleware

const getYoutubeProfiles = async (req, res, next) => {
  // Call youtube profile information
  const accounts = res.body;
  Promise.all(accounts.map(fetchYoutubeProfile))
    .then(updatedAccounts => {
      res.body = updatedAccounts;
      next();
    })
};

const updateProfiles = async (req, res, next) => {
  // Update DB with YouTube profstatisticsile info
  const accounts = res.body;
  Promise.all(accounts.map(updateMongoProfile))
    .then(res => next())
    .catch(err => next(err))
}

const getVideoLists = async (req, res, next) => {
  // Get recent videos list for every account
  const accounts = res.body;
  Promise.all(accounts.map(fetchVideos))
    .then(videos => {
      res.body.videos = videos;
      next();
    })
    .catch(err => next(err))
};

const getVideoStats = async (account) => {
  if (Array.isArray(account.videos) && account.videos.length) {
    account.videos = await Promise.all(account.videos.map(fetchVideoStats));
  }
  return account;
}

const getStats = async (req, res, next) => {
  // Get stats for each video of each profile
  const accounts = res.body;
  Promise.all(accounts.map(getVideoStats))
    .then(updatedAccounts => {
      res.body = updatedAccounts;
      next();
    })
    .catch(err => next(err))
}

const calculateStats = async (req, res, next) => {
  let accounts = res.body;
  accounts = await Promise.all(accounts.map(account => {
    if (Array.isArray(account.videos) && account.videos.length) {
      account.statistics = account.videos.reduce(function (accumulator, video, index) {
        const { viewCount, likeCount, dislikeCount, commentCount, favoriteCount } = video.statistics;
        accumulator.views_recent = accumulator.views_recent + parseInt(viewCount);
        accumulator.likes_recent = accumulator.likes_recent + parseInt(likeCount);
        accumulator.dislikes_recent = accumulator.dislikes_recent + parseInt(dislikeCount);
        accumulator.comments_recent = accumulator.comments_recent + parseInt(commentCount);
        accumulator.favorites_recent = accumulator.favorites_recent + parseInt(favoriteCount);
        accumulator.videos_recent = index;
        return accumulator;
      }, {
        views_recent: 0,
        likes_recent: 0,
        dislikes_recent: 0,
        comments_recent: 0,
        favorites_recent: 0,
        videos_recent: 0
        })
    } else {
      account.youtube_videos_status = 'Not available';
    }
  }))
  next();
}

const updateStats = async (req, res, next) => {
  const accounts = res.body;
  Promise.all(accounts.map(updateMongoStats))
    .then(res => next())
    .catch(err => next(err))
}

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('expires', '0');
  res.setHeader('pragma', 'no-cache');
  next();
});

app.use(getYoutubeAccounts);

app.get('/', (req, res) => res.sendStatus(200));
app.get('/profiles', getYoutubeProfiles, updateProfiles, (req, res) => res.json(res.body));
app.get('/videos', getVideoLists, getStats, calculateStats, updateStats, (req, res) => {
  res.sendStatus(200);
});

app.listen(port, () => console.log(`YouTube module is listening on port ${port}!`));