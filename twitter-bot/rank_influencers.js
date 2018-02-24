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
            //TODO for each influencer, check if their sentiment matches to the direction of the bitcoin price
        });
    }
  };
}());