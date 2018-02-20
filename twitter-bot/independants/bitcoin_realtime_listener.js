(function(){
  const BitcoinPriceManager = require('../bitcoin_price.js');

  //Derp, connect to mongo
  let mongoose = require('../mongo.connect.js');

  let btcPM = new BitcoinPriceManager();
  //Script
  //Pulls in historical data for btc price.
  var logic = (async() => {
    var newPrices = await btcPM.getHistoricalPrices();
  });

  logic();

  //Listens/binds to realtime price data from the markets
  // btcPM.listenToRealtime();
}());