const youtube = require('./youtube');
const mongo = require('./mongo');
const express = require('express');
const bodyParser = require('body-parser');

require('dotenv').config();

const port = process.env.PORT || 3000;

// Middleware

const getYoutubeAccounts = async (req, res, next) => {
  // Collect a list of influencers with youtube accounts
  res.body = await mongo.getYoutubeAccounts();
  next();
};

const getYoutubeProfiles = async (req, res, next) => {
  // Update every account with youtube profile information
  const accounts = res.body;
  Promise.all(accounts.map(youtube.fetchYoutubeProfile))
    .then((updatedAccounts) => {
      res.body = updatedAccounts;
      next();
    });
};

const updateProfiles = async (req, res, next) => {
  // Update DB with YouTube profile info for every account
  const accounts = res.body;
  Promise.all(accounts.map(mongo.updateYoutubeProfile))
    .then(() => next())
    .catch(err => next(err));
};

const getVideoLists = async (req, res, next) => {
  // Get recent videos list for every account
  const accounts = res.body;
  Promise.all(accounts.map(youtube.fetchVideos))
    .then((videos) => {
      res.body.videos = videos;
      next();
    })
    .catch(err => next(err));
};

const getVideoStats = async (account) => {
  // Update account video list with statistics for each video
  const updatedAccount = account;
  if (Array.isArray(account.videos) && account.videos.length) {
    updatedAccount.videos = await Promise.all(account.videos.map(youtube.fetchVideoStats));
  }
  return updatedAccount;
};

const getStats = async (req, res, next) => {
  // Gather video statistics for every account
  const accounts = res.body;
  Promise.all(accounts.map(getVideoStats))
    .then((updatedAccounts) => {
      res.body = updatedAccounts;
      next();
    })
    .catch(err => next(err));
};

const calculateStats = async (req, res, next) => {
  // Calculate cumulative stats and update accounts
  const accounts = res.body;
  res.body = await Promise.all(accounts.map((account) => {
    const updatedAccount = account;
    if (Array.isArray(account.videos) && account.videos.length) {
      updatedAccount.statistics = account.videos.reduce((accumulator, video, index) => {
        const {
          viewCount, likeCount, dislikeCount, commentCount, favoriteCount,
        } = video.statistics;
        return {
          viewsRecent: accumulator.viewsRecent + parseInt(viewCount, 10),
          likesRecent: accumulator.likesRecent + parseInt(likeCount, 10),
          dislikesRecent: accumulator.dislikesRecent + parseInt(dislikeCount, 10),
          сommentsRecent: accumulator.commentsRecent + parseInt(commentCount, 10),
          favoritesRecent: accumulator.favoritesRecent + parseInt(favoriteCount, 10),
          videosRecent: index,
        };
      }, {
        viewsRecent: 0,
        likesRecent: 0,
        dislikesRecent: 0,
        commentsRecent: 0,
        favoritesRecent: 0,
        videosRecent: 0,
      });
    } else {
      updatedAccount.youtubeVideoStatus = account.youtubeVideoStatus || 'Not available';
    }
    return updatedAccount;
  }));
  next();
};

const updateStats = async (req, res, next) => {
  const accounts = res.body;
  Promise.all(accounts.map(mongo.updateYoutubeStats))
    .then(() => next())
    .catch(err => next(err));
};

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('expires', '0');
  res.setHeader('pragma', 'no-cache');
  next();
});

app.use(getYoutubeAccounts);

app.get('/', getYoutubeProfiles, updateProfiles, getVideoLists, getStats, calculateStats, updateStats, (req, res) => res.send(res.body));
app.get('/profiles', getYoutubeProfiles, updateProfiles, (req, res) => res.sendStatus(200));
app.get('/videos', getVideoLists, getStats, calculateStats, updateStats, (req, res) => {
  res.sendStatus(200);
});

app.listen(port, () => console.log(`YouTube module is listening on port ${port}!`));
