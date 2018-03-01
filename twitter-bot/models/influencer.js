(function() {
  // AN INFLUENCER IS SOMEONE ON SOCIAL MEDIA THAT INFLUENCES THE MARKET IN SOME FASHION
  const async = require('async');
  let sentimentAnalyzer = new(require("../sentiment_analyzer.js"))();

  var mongoose = require('mongoose');
  var ObjectId = mongoose.Schema.Types.ObjectId;

  var influencerSchema = new mongoose.Schema({
    socialSource: { type: String, default: "twitter" }, //where thhe influencer was found? (for later if we need other sources like reddit etc)
    accountName: { type: String, required: true, index: { unique: true } }, //Twitter Handle
    userId: { type: String, required: true }, //Twitter user id
    name: { type: String }, // Influencers full name
    description: { type: String }, //Influencer's Desc on twitter
    followers: { type: Number }, //The total number of followers the influencer has
    foundOn: { type: Date, default: Date.now() }, //When the influencer was found
    tweets: [{
      id: { type: String, required: true },
      text: { type: String, required: true },
      dateRaw: { type: Date, require: true, index: true },
      dateUnix: { type: Number, required: true },
      sentiment: { type: String, required: true },
      sentimentScore: { type: Number }
    }], //List of influence tweets (only the most influencial?)
    tweetsAnalyzedCount: { type: Number, default: 0 },
    influenceScore: { type: Number }, //How much influence we think this influencer's content has on the price?
    influence: {
      negativeInfluence: { type: Number }, // out of all their tweets, what percent is negative
      positiveInfluence: { type: Number }, // out of all their tweets, what percent is positive
      positiveInfluencingTweets: [{ type: ObjectId }], //points to tweet in tweets
      negativeInfluencingTweets: [{ type: ObjectId }] // "
    },
    followed: { type: Boolean },
    sinceID: { type: String }, //see tweet_analysis.js
    maxID: { type: String } //see tweet_analysis.js
  });

  module.exports.Influencer = mongoose.model('Influencer', influencerSchema);
}());