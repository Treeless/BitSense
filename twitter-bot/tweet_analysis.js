(function() {
  //Author: Matthew Rowlandson
  // Purpose: Does our analysis on tweets
  const config = require('./config');
  const twitterConfig = config.twitter;
  const Twit = require('twit');
  const moment = require('moment');
  let Twitter = new Twit(twitterConfig);
  let models = require('./models');
  const Influencer = models.Influencer;

  let sentimentAnalyzer = new(require('./sentiment_analyzer.js'))();

  //Class
  module.exports = function(searchTerms) {
    //Builds our custom tweet object with our specified fields
    this.buildTweetObject = function(rawTweet) {
      return {
        id: rawTweet.id_str,
        text: rawTweet.text,
        dateRaw: rawTweet.created_at,
        dateUnix: moment(rawTweet.created_at, "ddd MMM DD HH:mm:ss +ZZ YYYY", 'en').valueOf(),
        sentiment: sentimentAnalyzer.getStringSentiment(rawTweet.text),
        sentimentScore: sentimentAnalyzer.getSentiment(rawTweet.text).score
      }
    };

    //Checks if a tweet is related to search terms
    this.hasSearchTerms = function(tweet) {
      //For each search term, look for it
      var found = false;
      for (var i = 0; i < searchTerms.length; i++) {
        if (tweet.text.indexOf(searchTerms[i]) > -1) {
          //We found one of the search terms.
          found = true;
          break;
        }
      }
      return found;
    };

    //NOTE: I'm going to leave this here for now..
    //      but the sentiment I was getting back for all my tweets was 'NEU'
    //      So i'm not using the code in SMSA (mike and eliot's repo)
    // SEE sentiment_analyzer.js for my nodejs version
    this.sentiment = function(tweet) {
      var text = tweet.text;
      return new Promise(function(resolve, reject) {
        var spawn = require("child_process").spawn;
        var pythonProcess = spawn('python', [config.pythonFilesPath + "/interfaces/sentiment.py", text]);

        pythonProcess.stdout.on('data', function(data) {
          resolve(data.toString('utf-8'));
        });

        // Handle error output
        pythonProcess.stderr.on('data', (data) => {
          reject(data.toString());
        });

        pythonProcess.on('exit', (code) => {
          //console.log("DONE");
        });
      });
    }


    //Returns the oldest tweet date we've gathered by an influencer
    this.getOldestTweetWeHave = function() {


      // THIS ISN"T RIGHT
      return new Promise(function(resolve, reject) {
        Influencer.aggregate([
            { "$unwind": "$tweets" },
            { "$sort": { "dateRaw": 1 } },
            {
              "$group": {
                "_id":"$accountName",
                "oldest": { $first: "$$ROOT" },
                "youngest": { $last: "$$ROOT" }
              }
            }
          ],
          function(err, tweets) {
            if(err){
                console.log(err);
            }  

            var sorted = tweets.sort(function(a, b){
                if(new Date(a.dateRaw).getTime() > new Date(b.dateRaw).getTime()){
                  return 1;
                }else{
                  return -1;
                }
            });


            console.log(sorted[0], sorted[sorted.length]);
          });
      });
    };


  };
}());