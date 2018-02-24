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
      dateRaw: { type: Date, require: true },
      dateUnix: { type: Number, required: true },
      sentiment: { type: String, required: true},
      sentimentScore: { type: Number }
    }], //List of influence tweets (only the most influencial?)
    tweetsAnalyzedCount: { type: Number, default: 0 },
    influenceChecked: { type: Boolean, default: false }, //If we have gone through all this influencers content and checked how it has influenced the price
    influenceScore: { type: Number }, //How much influence we think this influencer's content has on the price?
    followed: { type: Boolean },
    sinceID: { type: String }, //see tweet_analysis.js
    maxID: { type: String } //see tweet_analysis.js
  });

  module.exports.Influencer = mongoose.model('Influencer', influencerSchema);
}());