(function() {
  // This is for us to get stats on our influencers, their tweets, etc

  const models = require('./models');
  const Influencer = models.Influencer;
  const Chalk = require('chalk');
  const moment = require('moment');

  //vars
  let beginningOfToday = moment.utc().startOf('day').toDate()
  let endOfToday = moment.utc().endOf('day').toDate()

  module.exports = function() {
    this.runAll = function() {};


    this.overallTweetSentimentToday = function() {
      //How many tweets made today, postive vs negative vs neutral
      return new Promise(function(resolve, reject) {
        Influencer.aggregate([{
          "$match": {
            'tweets': {
              $elemMatch: {
                dateRaw: {
                  $gte: beginningOfToday,
                  $lte: endOfToday
                }
              }
            }
          }
        }, {
          "$project": {
            "tweets": {
              "$filter": {
                "input": "$tweets",
                "as": "el",
                "cond": {
                  "$and": [
                    { "$gte": ["$$el.dateRaw", beginningOfToday] },
                    { "$lt": ["$$el.dateRaw", endOfToday] }
                  ]
                }
              }
            }
          }
        }], function(err, influencers) {
          if (err) {
            return reject("Error with mongodb..." + err);
          }

          var tweets = [];
          for (var i = 0; i < influencers.length; i++) {
            tweets = tweets.concat(influencers[i].tweets);
          }

          //For each tweet, tally up how many are positive, neutral and negative
          var tallyObj = { pos: 0, neu: 0, neg: 0, total: tweets.length, nos: 0 }
          var highestScore = { pos: { score: 0, text: null }, neg: { score: 0, text: null } }
          for (i = 0; i < tweets.length; i++) {
            if (tweets[i].sentiment == "pos") {
              tallyObj.pos += 1;
              if (tweets[i].sentimentScore > highestScore.pos.score) {
                highestScore.pos = { "text": tweets[i].text, "score": tweets[i].sentimentScore }
              }
            } else if (tweets[i].sentiment == "neu") {
              tallyObj.neu += 1;
            } else if (tweets[i].sentiment == "neg") {
              tallyObj.neg += 1;
              if (tweets[i].sentimentScore < highestScore.neg.score) {
                highestScore.neg = { "text": tweets[i].text, "score": tweets[i].sentimentScore }
              }
            } else {
              //no sentiment
              tallyObj.nos++;
            }
          }

          console.log(Chalk.blue("Tweet sentiment TODAY for bitcoin:"), tallyObj);
          console.log(Chalk.green("most positive tweet today:"), highestScore.pos.score, highestScore.pos.text);
          console.log(Chalk.red("most negative tweet today:"), highestScore.neg.score, highestScore.neg.text);
          resolve(tallyObj)
          resolve(tallyObj)
        });
      });
    };
  };

}())