const { MongoClient } = require("mongodb");
const assert = require("assert");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;

require("dotenv").config();

const getYoutubeAccounts = async () => {
  // Collect a list of influencers with youtube accounts
  let accounts;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db(process.env.DB_NAME);
    const col = db.collection(process.env.DB_COLLECTION);
    accounts = await col
      .find({
        $or: [{ youtube_name: { $gt: "" } }, { youtube_id: { $gt: "" } }]
      })
      .project({ youtube_name: 1, youtube_id: 1 })
      .toArray();
    client.close();
  } catch (e) {
    console.error(e);
  }
  return accounts;
};

const updateYoutubeProfile = async account => {
  // Update youtube profile info in the database
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db(process.env.DB_NAME);
    const col = db.collection(process.env.DB_COLLECTION);
    if (account.youtubeStatus === "OK") {
      col.updateOne(
        { _id: account._id },
        {
          $set: {
            youtube_title: account.youtubeTitle,
            youtube_description: account.youtubeDescription,
            youtube_views: account.youtubeViews,
            youtube_subscribers: account.youtubeSubscribers,
            youtube_videos: account.youtubeVideos,
            youtube_thumbnail: account.youtubeThumbnail,
            youtube_thumbnail_med: account.youtubeThumbnailMed,
            youtube_thumbnail_high: account.youtubeThumbnailHigh,
            youtube_status: account.youtubeStatus,
            youtube_updated: Date.now()
          }
        },
        (err, result) => {
          assert.equal(err, null);
          assert.equal(1, result.result.n);
        }
      );
    } else {
      col.updateOne(
        { _id: account._id },
        {
          $set: {
            youtube_status: account.youtubeStatus,
            youtube_updated: Date.now()
          }
        },
        (err, result) => {
          assert.equal(err, null);
          assert.equal(1, result.result.n);
        }
      );
    }
    client.close();
  } catch (e) {
    console.error(e);
  }
};

const updateYoutubeStats = async account => {
  // Update tweets stats in the database
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db(process.env.DB_NAME);
    const col = db.collection(process.env.DB_COLLECTION);
    if (account.youtubeVideoStatus === "OK") {
      const {
        viewsRecent,
        likesRecent,
        dislikesRecent,
        commentsRecent,
        favoritesRecent,
        videosRecent
      } = account.statistics || {};
      col.updateOne(
        { _id: account._id },
        {
          $set: {
            youtube_views_recent: viewsRecent,
            youtube_likes_recent: likesRecent,
            youtube_dislikes_recent: dislikesRecent,
            youtube_comments_recent: commentsRecent,
            youtube_favorites_recent: favoritesRecent,
            youtube_videos_recent: videosRecent,
            youtube_videos_status: account.youtubeVideoStatus,
            youtube_videos_cycle: process.env.STATS_SINCE_DAYS,
            youtube_videos_updated: Date.now()
          }
        },
        (err, result) => {
          assert.equal(err, null);
          assert.equal(1, result.result.n);
        }
      );
    } else {
      col.updateOne(
        { _id: account._id },
        {
          $set: {
            youtube_videos_status: account.youtubeVideoStatus,
            youtube_videos_updated: Date.now()
          }
        },
        (err, result) => {
          assert.equal(err, null);
          assert.equal(1, result.result.n);
        }
      );
    }
    client.close();
  } catch (e) {
    console.error(e);
  }
};

module.exports = {
  getYoutubeAccounts,
  updateYoutubeProfile,
  updateYoutubeStats
};
