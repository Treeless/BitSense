(function() {
  const moment = require('moment');
  const Chalk = require('chalk');
  const Async = require('async');
  const config = require('./config');
  const models = require('./models');
  const InfluencerRetriever = require('./get_influencers.js');
  const InfluencerActions = require('./actions_influencers.js');
  const InfluencerScore = require('./score_influencers.js'); //Logic class for searching what effect the influencer may have on the price of the currency
  const BitcoinPriceRetriever = require('./bitcoin_price.js');
  const TweetAnalysis = require('./tweet_analysis.js');
  const Stats = require('./stats.js')

  let mongoose = null; // = require('mongoose');'
  const Influencer = models.Influencer;

  let searchTerms = ['#BTC', '$BTC', "#BITCOIN", "#Bitcoin", "#bitcoin", "@bitcoin", "bitcoin", "BTC", "#bitcoinnews"];
  let influencerRetriever = new InfluencerRetriever(searchTerms);
  let influencerActions = new InfluencerActions(searchTerms);
  let influencerScore = new InfluencerScore();
  let bitcoinPriceRetriever = new BitcoinPriceRetriever();
  let tweetAnalysis = new TweetAnalysis();
  let stats = new Stats();

  //APP FUNCTION VARIABLES (for dev)
  const FIND_INFLUENCERS = true; //Allow the process of going through twitter, finding influencers, getting their tweets etc
  const RANK_INFLUENCERS = true; //Allow the ranking process of influencers
  const SHOW_STATS = true; //Show stats only
  //

  //RUN all the logic asyncronyously
  const logic = (async() => {
    //First connect to mongodb
    mongoose = await require('./mongo.connect.js');

    if (FIND_INFLUENCERS) {
      //Get a list of influencers ranked by their level of engagement (initially we aren't going to store them, just do it on the fly...)
      var results = await influencerRetriever.search(); //Finds new influencers and saves them to MONGO

      //Get all the people that the bot is following (INFLUENCERS we've checked in the past)
      var followerIdsList = await influencerActions.getFollowersList("cryptosensebot");
      console.log("People following cryptosensebot: ", followerIdsList.length);

      //----------------------------------------------------------------------
      //Now get all of our influencers tweets
      var totalNewRelatedTweets = 0;
      var influencersAnalyzed = await new Promise(function(resolve, reject) {
        console.log("Analyzing new influencers...")
        Influencer.find({}, function(err, influencers) {
          var tasks = [];

          for (var i = 0; i < influencers.length; i++) {
            var obj = influencers[i];
            tasks.push(function(influencer) {
              return function(cb) {
                // Step 1: Check their tweets for the `searchTerms`
                console.log("Getting ", ((influencer.tweetsAnalyzedCount > 0) ? Chalk.blue("RECENT") : Chalk.yellow("ALL")), "tweets for", influencer.accountName)
                //Search all tweets made by the influencer for new tweets with once of the search terms. Save them
                function getTweets(callback) {
                  influencerActions.getTweetsAndAnalyze(influencer).then(function(info) {
                    //info object: totalInfluencerRelatedTweets, analyzedTweetsCount, searchTermsTweetsCount
                    if (info == null) {
                      //influencer must have been removed, continue
                      return callback();
                    }
                    if (info.analyzedTweetsCount == 0) {
                      console.log("DONE getting tweets for:", influencer.accountName)
                      callback(); //done
                    } else {
                      //Get more!
                      totalNewRelatedTweets += info.searchTermsTweetsCount | 0;
                      console.log("total:", info.totalInfluencerRelatedTweets, "analyzed:", info.analyzedTweetsCount, "NEW:", (info.searchTermsTweetsCount) ? Chalk.green(info.searchTermsTweetsCount.toString() + "++") : '')
                      getTweets(callback);
                    }
                  }, function(err) {
                    console.log("PROBLEM GETTING USER", influencer.accountName, "TWEETS")
                    callback(err);
                  })
                }

                getTweets(cb); //Start off the chain

              };
            }(obj))
          }

          Async.series(tasks, function(err, outputs) {
            if (err) {
              console.log(Chalk.red("THERE WAS AN ERROR :S"), ":", err);
              reject(err)
            } else {
              resolve(outputs.length);
            }
          });
        });
      });
      console.log("DONE");
      console.log("Influencers analyzed:", influencersAnalyzed);
      console.log("New " + Chalk.blue("related") + " tweets found:", totalNewRelatedTweets)
      //----------------------------------------------------------------------
    } //End of FIND_INFLUENCERS functionality


    //FOR ALL INFLUENCERS we have in mongo. Compute their 'influencer score' using metrics outlined below
    // Step 1: see what influence (via time span 1-2 days after POST) they have on bitcoin price, based on sentiment of tweet as well.)

    if (RANK_INFLUENCERS) {
      console.log("Rank influencers process started");
      var bitcoinStart = new Date("01-01-2009").getTime() / 1000; //BITCOIN START DATE 2009

      console.log("Getting bitcoin price...")
      var today = Math.round((new Date()).getTime() / 1000); //today
      var priceData = await bitcoinPriceRetriever.getHistoricalPrices(bitcoinStart, today);

      //note: format of data: "YYYY-MM-DD : { crypto: 'BTC', timestamp: 1519794000, close: 10397.9,high: 11089.8,low: 10393.1,open: 10687.2,usd_market_cap: 180510000000, usd_volume: 6936190000}"
      //Now which piece of price information do we look at? Open to close, low to high for the day

      //Get all the influencers
      Influencer.find({}, function(err, influencers) {
        var tasks = [];

        //for each influencer, go through and check get each of their tweets
        for (var i = 0; i < influencers.length; i++) {
          var influencer = influencers[i]
          var influencerTally = { up: 0, down: 0, tweetUp: [], tweetDown: [] }
          for (var j = 0; j < influencer.tweets.length; j++) {
            var tweet = influencer.tweets[j];
            //Get the price
            var tweetDate = moment(tweet.dateRaw);
            var priceKey = tweetDate.format("YYYY-MM-DD");
            var dateSpread = { dayBefore: tweetDate.subtract(1, 'days').format("YYYY-MM-DD"), dayOf: tweetDate.format("YYYY-MM-DD"), dayAfter: tweetDate.add(1, 'days').format("YYYY-MM-DD") };
            var price = priceData[priceKey];
            var sentiment = tweet.sentiment; //neg. neu. pos.

            //Analyze how the price has changed over the few days
            var analysis = bitcoinPriceRetriever.priceAnalysis(dateSpread, priceData);

            //Note: for now its just true or false. True if the price went up, false if the price went down. I'll make it better down the road
            if (analysis == null) {
              continue; //we are missing price data. so ignore the tweet
            }
            if (analysis == true && tweet.sentiment == "pos") {
              //price went up that day and the tweet sentiment was positive
              influencerTally.up += 1;
              influencerTally.tweetUp.push(tweet._id);
            } else if (analysis == false && tweet.sentiment == "neg") {
              //Price went down and their tweet was negative
              influencerTally.down += 1;
              influencerTally.tweetDown.push(tweet._id);
            }
          }

          if (influencer.tweets.length == 0 || (influencerTally.up == 0 && influencerTally.down == 0)) {
            console.log("influencer", influencer.accountName, "has no tweets to analyze");
            return;
          }

          //Set influencer score based on how many tweets they made
          var totalTweets = influencer.tweets.length;
          var negativeInfluencePercent = (influencerTally.down / totalTweets) * 100;
          var positiveInfluencePercent = (influencerTally.up / totalTweets) * 100;

          influencer.influence = {
            negativeInfluence: negativeInfluencePercent,
            positiveInfluence: positiveInfluencePercent,
            positiveInfluencingTweets: influencerTally.tweetUp,
            negativeInfluencingTweets: influencerTally.tweetDown
          };

          influencer.save();
        }

      })


      console.log("RANKING INFLUENCERS...")
    }

    if (SHOW_STATS) {
      var done = await stats.overallTweetSentimentToday()
    }







    //Overall
    //Pull all most popular tweets from those main influencers (that contain the coin reference)

    //Grab their sentiment for each tweet

    //Compare each tweet's submission date with the bitcoin price a few hours later.

    //Correlation? (if so, save that tweet)

    //All the tweets that were correlating for that day, combine into a single tweet.

    //Submit the tweet to cryptosense-bot
    //  FORMAT: BTC price today at 12pm: $12000 USD
    //          Top 5 most popular influencial tweets:
    //          - RT @philip12342 Bitcoin is going to $100K !

    //TODO, do additional analysis weekly of the price and our predictions for the price the following week.

  });


  //Run other processes HERE
  //TODO bitcoin price realtime monitor HERE

  //


  logic();

}());