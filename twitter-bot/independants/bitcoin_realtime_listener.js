(function(){
  const mongoose = require('../mongo.connect.js');
  const BitcoinPriceManager = require('../bitcoin_price.js');

  let btcPM = new BitcoinPriceManager();

  //Listens/binds to realtime price data from the markets
  btcPM.listenToRealtime();
}());