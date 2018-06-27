const moment = require('moment');
const request = require('request-promise-native');
require('dotenv').config();

const fetchYoutubeProfile = async (account) => {
  let updatedAccount = account;
  const uri = account.youtube_id ?
    `https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&id=${account.youtube_id}&key=${process.env.API_KEY}` :
    `https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&forUsername=${account.youtube_name}&key=${process.env.API_KEY}` 
  await request(uri)
    .then((body) => {
      if ((body === undefined) || (body === null)) {
        const youtubeStatus = 'Invalid name';
        updatedAccount = Object.assign(updatedAccount, { youtubeStatus });
        return;
      }
      const results = JSON.parse(body);
      if (!results.pageInfo.totalResults) {
        const youtubeStatus = 'Not Found';
        updatedAccount = Object.assign(updatedAccount, { youtubeStatus });
        return;
      }
      const { id: youtubeId } = results.items[0];
      const {
        viewCount: youtubeViews,
        commentCount: youtubeComments,
        subscriberCount: youtubeSubscribers,
        videoCount: youtubeVideos,
      } = results.items[0].statistics;
      const {
        title: youtubeTitle,
        description: youtubeDescription,
        thumbnails,
      } = results.items[0].snippet;
      const youtubeThumbnail = thumbnails.default.url;
      const youtubeThumbnailMed = thumbnails.medium.url;
      const youtubeThumbnailHigh = thumbnails.high.url;
      const youtubeStatus = 'OK';
      updatedAccount = Object.assign(updatedAccount, {
        youtubeId,
        youtubeTitle,
        youtubeDescription,
        youtubeViews,
        youtubeComments,
        youtubeSubscribers,
        youtubeVideos,
        youtubeThumbnail,
        youtubeThumbnailMed,
        youtubeThumbnailHigh,
        youtubeStatus,
      });
    })
    .catch(err => console.log(err));
  return updatedAccount;
};

const fetchVideos = async (account) => {
  // Fetch recent videos for account
  const updatedAccount = account;
  if (!account.youtube_id) {
    return account;
  }
  const since = moment().subtract(process.env.STATS_SINCE_DAYS, 'days').utc().format();
  await request(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${account.youtube_id}&order=date&type=video&publishedAfter=${since}&key=${process.env.API_KEY}`)
    .then((body) => {
      const results = JSON.parse(body);
      updatedAccount.videos = results.items;
      updatedAccount.youtubeVideoStatus = 'OK';
    })
    .catch((err) => {
      updatedAccount.youtubeVideoStatus = err.message;
    });
  return updatedAccount;
};

const fetchVideoStats = async (video) => {
  // Fetch video statistics
  const updatedVideo = video;
  await request(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${video.id.videoId}&key=${process.env.API_KEY}`)
    .then((stats) => {
      const { statistics } = JSON.parse(stats).items[0];
      updatedVideo.statistics = statistics;
    })
    .catch((err) => {
      console.log(err);
    });
  return updatedVideo;
};

module.exports = {
  fetchYoutubeProfile,
  fetchVideos,
  fetchVideoStats,
};
