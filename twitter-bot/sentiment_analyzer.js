(function() {
  // I kept getting neutral from the python library that mike made, so I'm making my own here.

  const sentiment = require('sentiment'); //https://www.npmjs.com/package/sentiment

  //AFINN is a list of words rated for valence with an integer between minus five (negative) and plus five (positive). Sentiment analysis is performed by cross-checking the string tokens(words, emojis) with the AFINN list and getting their respective scores.
  module.exports = function() {
    //private

    //public
    this.getSentiment = function(text) {
      // The comparative score is simply: sum of each token / number of tokens
      //
      return sentiment(text);
    }

    this.parseScore = function(score) {
      if (score == 0 || score == 1 || score == -1) {
        return 'neu'
      }
      if (score > 1) {
        return 'pos'
      }
      if (score < -1) {
        return 'neg'
      }

      console.log("missed a condition?")
      return 'neu'
    }

    this.getStringSentiment = function(text) {
      return this.parseScore(this.getSentiment(text).score);
    }
  }
}());