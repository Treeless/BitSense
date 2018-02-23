(function() {
  // Author: Matthew Rowlandson @treeless
  // Description: This class is used for retrieving the bitcoin prices
  // Solution: https://stackoverflow.com/questions/16143266/get-bitcoin-historical-data
  // TODO: Get bitcoin prices for the PAST: http://api.bitcoincharts.com/v1/csv/bitstampUSD.csv.gz (updated regularly (each day)) [Note, this is a massive 150MB+ file, compressed. 1gb or so uncompressed]

  //We're using https://www.bitstamp.net/websocket/ for live btc/usd prices via listening via a websocket. (this is basically us listening to transactions on the bitstamp exchange)

  //IMPORTANT TO NOTE. Bitstamp is only one exchange, if we really wanted a wider spread of exchange data to get a better price average, we'll need to listen to more exchanges realtime data.

  const request = require('request');
  const Chalk = require('chalk');
  const Pusher = new require('pusher-js');
  const config = require('./config');

  const models = require('./models');
  const Price = models.Price;

  //Pusher data from [https://www.bitstamp.net/websocket/]
  const PUSHER_info = { event: "trade", channel: "live_trades", "key": "de504dc5763aeef9ff52" };
  //

  module.exports = function() {
    //private

    //Public

    // Get the current prices and volumes of bitcoin.
    this.getPricesNow = function() {
      return new Promise(function(resolve, reject) {
        var spawn = require("child_process").spawn;
        var pythonProcess = spawn('python', [config.pythonFilesPath + "/interfaces/prices.py", "now"]);

        pythonProcess.stdout.on('data', function(data) {
          // On output (our data)
          data = JSON.parse(data.toString('utf-8'));
          resolve(data);
        });

        // Handle error output
        pythonProcess.stderr.on('data', (data) => {
          reject(data.toString());
        });

        pythonProcess.on('exit', (code) => {
          //console.log("DONE");
        });
      });
    };

    //Return the historical price data for the information
    //Given the startDate (unix timestamp) and endDate (unix timestamp)
    this.getHistoricalPrices = function(startDate, endDate) {
      return new Promise(function(resolve, reject) {
        var spawn = require("child_process").spawn;
        var pythonProcess = spawn('python', [config.pythonFilesPath + "/interfaces/prices.py", "historical", startDate, endDate]);

        pythonProcess.stdout.on('data', function(data) {
          // On output (our data)
          data = JSON.parse(data.toString('utf-8'));
          resolve(data);
        });

        pythonProcess.stderr.on('data', (data) => {
          reject(data.toString());
        });

        pythonProcess.on('exit', (code) => {
          //console.log("DONE");
        });
      });
    }

    //This is for listening to realtime trades, not used right now, but see independants/bbitcoin_realtime_listener.js for how we will use this
    //BITSTAMP REALTIME PRICES
    this.listenToRealtime = function() {
      let pusher = new Pusher(PUSHER_info.key);
      let liveTradesChannel = pusher.subscribe(PUSHER_info.channel);

      let totalTradesProcessed = 0;
      let tradesInWindow = 0;

      console.log("Starting listener...")
      //Get the total number of prices documents
      Price.find().count().exec(function(err, count) {
        if (err) {
          console.log("ISSUE GETTING PRICES")
        }
        totalTradesProcessed = count || 0;

        console.log("Existing trades stored:", totalTradesProcessed);

        console.log("Listening for realtime bitcoin trades...")
        liveTradesChannel.bind('trade',
          function(data) {
            //amount is the amount of btc that was purchased.
            //id, unique identifier for that purchase from bitstamp
            //price, the price of bitcoin at the time of purchase (USD)
            //timestamp, the unix timetamp of the purchase
            var newPrice = new Price({ fromRealtime: true, amount: data.amount, price: data.price, timestamp: data.timestamp });
            newPrice.save(); //save the new price (this is an async function)

            tradesInWindow++;
          }
        );

        //Every few seconds, tell us how many trades we processed (just for development purposes eh)
        var watchingInterval = setInterval(function() {
          totalTradesProcessed += tradesInWindow;
          console.log("Total: (" + totalTradesProcessed.toLocaleString() + ")", ((tradesInWindow > 0) ? Chalk.green("New: +" + tradesInWindow.toString()) : Chalk.red('-')));
          tradesInWindow = 0;
        }, 15000);
      });
    }
  }
}());