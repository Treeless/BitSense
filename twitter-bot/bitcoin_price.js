(function() {
  // Author: Matthew Rowlandson @treeless
  // Description: This class is used for retrieving the bitcoin prices
  // Solution: https://stackoverflow.com/questions/16143266/get-bitcoin-historical-data
  // TODO: Get bitcoin prices for the PAST: http://api.bitcoincharts.com/v1/csv/localbtcCAD.csv.gz (updated regularly (each day))
  // (column 1) the trade's timestamp
  // (column 2) the price
  // (column 3) the volume of the trade
  // TODO: bitcoin prices in realtime: https://www.bitstamp.net/websocket/


  //TODO: https://www.bitstamp.net/websocket/ for live btc/usd prices via listening via a websocket.

  //IMPORTANT TO NOTE. Bitstamp is only one exchange, if we really wanted a wider spread of exchanges data, we'll need to listen to more exchanges realtime data.

  const request = require('request');
  const Chalk = require('chalk');
  const parse = require('csv-parse');
  const fs = require('fs');
  const zlib = require('zlib');
  const Pusher = new require('pusher-js');

  const models = require('./models');
  const Price = models.Price;

  //Pusher data from [https://www.bitstamp.net/websocket/]
  const PUSHER_info = { event: "trade", channel: "live_trades", "key": "de504dc5763aeef9ff52" };
  //

  module.exports = function() {
    //private


    //Public
    this.getHistoricalPrices = function() {
      return new Promise(function(resolve, reject) {
        //First, check if we already have the bitcoin CSV
        //If we have the bitcoin csv, then check how old it is, if its older then a day, then we need to get the newest historicall data

        //Get the bitstamp CSV
        request({
          uri: "http://api.bitcoincharts.com/v1/csv/bitstampUSD.csv.gz"
        }, function(err, response, data) {
          if (err || response.statusCode != 200) {
            console.log("Issue getting the historical bitcoin data.", err || response.statusCode);
            return;
          }

          zlib.deflate(data, function(err, buf) {
              console.log("in the deflate callback:", buf.toString("utf8"));

              // zlib.inflate(buf, function(err, buf) {
              //         console.log("in the inflate callback:", buf);
              //         console.log("to string:", buf.toString("utf8") );
              // });

          });

          // console.log("Unzipping data...")
          // var decompressedData = zlib.deflateSync(data).toString('utf8')
          // console.log("Parsing csv data...")
          // var historicalData = parse(decompressedData, { columns: true });
          // console.log("data:", historicalData);

          // For each row, save to mongo.
          //Read in the data and parse it as individual pieces of data
          //If we already have the date of the row, ignore it.
          //otherwise, create a price record.
        });
      });
    }

    //BITSTAMP REALTIME PRICES
    this.listenToRealtime = function() {

      let pusher = new Pusher(PUSHER_info.key);
      let liveTradesChannel = pusher.subscribe(PUSHER_info.channel);

      let totalTradesProcessed = 0;
      let tradesInWindow = 0;

      console.log("Starting listener...")
      Price.find().count().exec(function(err, count) {
        if (err) {
          console.log("ISSUE GETTING PRICES")
        }
        totalTradesProcessed = count || 0;

        console.log("Existing trades stored:", totalTradesProcessed);

        console.log("Listening for realtime bitcoin trades...")
        liveTradesChannel.bind('trade',
          function(data) {
            // console.log("NEW TRADE!", data);
            //amount is the amount of btc that was purchased.
            //id, unique identifier for that purchase from bitstamp
            //price, the price of bitcoin at the time of purchase (USD)
            //timestamp, the unix timetamp of the purchase
            var newPrice = new Price({ amount: data.amount, uniq_id: data.id, price: data.price, timestamp: data.timestamp });
            newPrice.save();

            tradesInWindow++;
          }
        );

        //Every few seconds, tell us how many trades we processed
        var watchingInterval = setInterval(function() {
          totalTradesProcessed += tradesInWindow;
          console.log("Total: (" + totalTradesProcessed.toLocaleString() + ")", ((tradesInWindow > 0) ? Chalk.green("New: +" + tradesInWindow.toString()) : Chalk.red('-')));
          tradesInWindow = 0;
        }, 15000);
      });
    }
  }
}());