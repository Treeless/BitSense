(function() {
  //Library for ranking influencers (using multiple metrics)

  const models = require('./models');
  const Influencer = models.Influencer;
  const async = require('async');

  let tweetAnalysis = new require('./tweet_analysis')();


  module.exports = function() {
    //Private

    //Public
    this.rankInfluencers = function() {
      // Grab all the influencers (that have some tweets [0 exists, meaning first index exists])
      Influencer
        .find({ "tweets.0": { "$exists": true } })
        .sort('tweets', "-1")
        .exec(function(err, influencers) {

          // Grab all the prices of bitcoin (sorted by date)
          var

          //For each tweet, get the sentiment (positive or negative?)

          // Compare the tweets
        });
    }
  };
}());