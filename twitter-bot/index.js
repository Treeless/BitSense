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

  let searchTerms = ['#BTC', '$BTC', "#BITCOIN", "#Bitcoin", "#bitcoin", "@bitcoin", "bitcoin", "BTC", "#bitcoinnews"]; //Search terms
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

    //I've split the logic below into 3 different pieces.
    // FIND_INFLUENCERS is the retrieval of influencers and their tweets
    // RANK_INFLUENCERS is the analysis of the influencers's tweets and score
    // SHOW_STATS is just a bunch of stats related to the data gathered in the first 2 pieces

    //Find influencers from twitter based on search terms and get 
    if (FIND_INFLUENCERS) {
      //Get a list of influencers ranked by their level of engagement (initially we aren't going to store them, just do it on the fly...)
      var results = await influencerRetriever.search(); //Finds new influencers and saves them to MONGO

      //Get all the people that the bot is following (INFLUENCERS we've checked in the past) [WE ONLY FOLLOW HIGHLY SCORED INFLUENCERS]
      var followerIdsList = await influencerActions.getFollowersList("cryptosensebot");
      console.log("People following cryptosensebot: ", followerIdsList.length);

      //----------------------------------------------------------------------
      //Go and look for new influencers on twitter
      var totalNewRelatedTweets = 0;

      //note: since all the calls for this run asyncronously we wrap it in a promise to stop the code after this from running
      // see the `await`
      var influencersAnalyzed = await new Promise(function(resolve, reject) {
        console.log("Analyzing new influencers...")

        //Get all our influencers we have in MONGODB
        Influencer.find({}, function(err, influencers) {
          var tasks = [];

          //For each influencer we retrieved
          for (var i = 0; i < influencers.length; i++) {
            var obj = influencers[i];

            //We need to go look for the influencer tweets but only one at a time. 
            // Using the async library and the SERIES function. Which lets us run pockets of code for each influencer independently
            //   and in a syncronyous fashion

            //So here we are adding the code we are going to run for each influencer in the 'tasks' array and making sure each function being
            //  added knows about the influencer its going to be analyzing
            tasks.push(function(influencer) {
              return function(cb) {
                // Step 1: Check influencer tweets for the `searchTerms`
                console.log("Getting ", ((influencer.tweetsAnalyzedCount > 0) ? Chalk.blue("RECENT") : Chalk.yellow("ALL")), "tweets for", influencer.accountName)

                //Search all tweets made by the influencer for new tweets with once of the search terms. Save them
                // PLEASE NOTE: this is a recursive function, gets called multiple times per influencer to allow for all the tweets from all time to get 
                //   retrieved
                function GetTweets(callback) {

                  //For the influencer we've found get all of their related tweets for the searchTerms (see up top for search terms)
                  influencerActions.getTweetsAndAnalyze(influencer).then(function(info) {
                    //info object: totalInfluencerRelatedTweets, analyzedTweetsCount, searchTermsTweetsCount

                    //If no information/stats are returned by the function above as info, then that influencer no longer exists on twitter!
                    // Account must have been deleted
                    if (info == null) {
                      //influencer must have been removed, continue
                      return callback();
                    }

                    //If we ended up not getting any tweets analyzed for the last getTweetsAndAnalyzed call, it means we've analyzed ALL of their tweets
                    if (info.analyzedTweetsCount == 0) {
                      console.log("DONE getting tweets for:", influencer.accountName)
                      callback(); //done
                    } else {
                      //We still have tweets to get, get more but output our stats for the last call getTweetsAndAnalyze
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


                //The first call that starts off the chain of calls
                getTweets(cb);

              };
            }(obj))
          }

          //Run all the functions in series for each influencer.
          Async.series(tasks, function(err, outputs) {
            if (err) {
              console.log(Chalk.red("THERE WAS AN ERROR :S"), ":", err);
              reject(err)
            } else {
              //See influencersAnalyzed variable for the tallied stats 
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
  //TODO bitcoin price realtime price monitor

  //


  logic();

}());