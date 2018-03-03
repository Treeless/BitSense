# Cryptosense Twitter BOT
<a href="https://twitter.com/Cryptosensebot">@cryptosensebot</a>

Basically created a twitter bot that goes through this process:
* [DONE] Searches twitter for influencers that post about bitcoin
* [DONE] Stores those influencers
* [DONE] Finds all the influencer's tweets from all time that are about bitcoin
* [DONE] Checks how those tweets via sentiment and timeframe relate to the bitcoin price
* [TODO] Ranks the influencers based on their tweets relation to the price (the more correct the sentiment to price increase, the better the score)
* [TODO] The highest scoring influencers for the day, will have their relevant content retweeted.

Classes and what they do:
* index.js - The main script. Holds the logic for getting influencers, finding their tweets and anazlying, and then ranking them and saving them to the database
* get_influencers.js
    * `Search()` - Searches twitter for tweets matching our keywords, only saves the top influencers of the search.
    * bitcoin_price.js - Interfaces with the <a href="https://github.com/MichaelDragan/SMSA">SMSA Repo</a> to retrieve the bitcoin prices. Runs the python scripts
    * `getPricesNow()` - Gets the current bitcoin prices at the present moment
    * `getHistoricalPrices(startDate, endDate)` - Retrieves the BTC prices from time between two timestamps given 
* sentiment_analyzer.js - Sentiment analyzer for a string of text
    * `getSentiment(text)` - Returns a sentiment score for a given text string
    * `parseScore(sentiment)` - Returns a string representation of the score (pos, neg, neu)
* [WIP] rank_influencers.js - Will rank the influencers based on their total influence 
* actions_influencers.js - Handles most of the twitter API calls for the twitter bot
    * `getFollowersList()` - Returns the list of people followering @cryptosensebot
    * `follow(influencer)` - Follows the influencer via the twitter bot
    * [WIP] `unfollow(influencer)` - unfollows the influencer on the twitter bot
    * `getTweetsAndAnalyze(influencer)` - Returns all the search term related tweets for the influencer from all time.


<img src="https://github.com/Treeless/BitSense/blob/master/twitter-bot/twitter-bot-flow.jpg?raw=true" alt="Cryptosensebot flow" width="600">

## EMBEDDED CODE TO USE
```html
<a class="twitter-timeline" href="https://twitter.com/Cryptosensebot?ref_src=twsrc%5Etfw">Tweets by Cryptosensebot</a>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
```