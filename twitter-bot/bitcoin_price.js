(function() {
  // Author: Matthew Rowlandson @treeless
  // Description: This class is used for retrieving the bitcoin prices
  // Solution: https://stackoverflow.com/questions/16143266/get-bitcoin-historical-data
  // TODO: Get bitcoin prices for the PAST: http://api.bitcoincharts.com/v1/csv/bitstampUSD.csv.gz (updated regularly (each day)) [Note, this is a massive 150MB+ file, compressed. 1gb or so uncompressed]

  //We're using https://www.bitstamp.net/websocket/ for live btc/usd prices via listening via a websocket. (this is basically us listening to transactions on the bitstamp exchange)

  //IMPORTANT TO NOTE. Bitstamp is only one exchange, if we really wanted a wider spread of exchange data to get a better price average, we'll need to listen to more exchanges realtime data.

  const request = require('request');
  const Chalk = require('chalk');
  const csv = require('fast-csv');
  const fs = require('fs');
  const glob = require('glob');
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
        //First, check if we already filled the historical data
        var exists = fs.existsSync(__dirname + "/data/filled.txt"); //note, filled will contain the date we last sync'd the data for
        if (exists) {
          //(NOTE: we may have some dead spots from when we were not listening to realtime.
          //  TODO, get the CSV, add price data for timestamps after last entered price)
          console.log("Already got the data... no need to get historical data again")
          return resolve(0);
        }


        var pricesObjects = [[], []];
        var firstArr = true; //if we are inserting values at all
        //CSV parse stream
        var csvStream = csv()
          .on("data", function(row) {
            // (column 1) the trade's timestamp
            // (column 2) the price
            // (column 3) the volume of the trade
            //if we are inserting, use the second array to add elements to, as we insert the first array
            var arr = ((firstArr) ? pricesObjects[0] : pricesObjects[1]);
            arr.push({ timestamp: row[0], price: parseInt(row[1]), amount: parseInt(row[2]) })

            //Every 500,000 objects, tell us how many we have
            if(arr.length % 500000 == 0){
              console.log("Processed", arr.length.toLocaleString(), "objects so far");
            }

            if(arr.length > 10000000){
              firstArr = !firstArr;
              Price.insertMany(((!firstArr) ? pricesObjects[0] : pricesObjects[1]), function(err, docs){
                console.log(Chalk.green(docs.length.toString()+" INSERTED!"));
                if(firstArr){
                  pricesObjects[0] = []; //clear first arr
                }else{
                  pricesObjects[1] = []; //cclear second arr
                }
              });
            }
          })
          .on("end", function() {
            var arr = ((firstArr) ? pricesObjects[0] : pricesObjects[1]);
            //Do bulk insert
            console.log("Bulk inserting", arr.length, "records.")
            Price.insertMany(arr, function(err, docs) {
              if (err) {
                //todo handle error
                reject();
              } else {
                console.log("Done")

                fs.writeFileSync(__dirname+'data/filled.txt', Date.now().toString());

                resolve(docs.length);
              }
            });
          });

        //Get the bitstamp CSV
        var stream = request({
            uri: "http://api.bitcoincharts.com/v1/csv/bitstampUSD.csv.gz",
            headers: {
              'Accept-Encoding': 'gzip'
            }
          })
          .pipe(zlib.createGunzip())
          .pipe(csvStream);
      });
    }

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
            var newPrice = new Price({ amount: data.amount, price: data.price, timestamp: data.timestamp });
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