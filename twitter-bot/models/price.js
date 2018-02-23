(function() {
  // Price model for storing the price of the coin
  var mongoose = require('mongoose');
  var ObjectId = mongoose.Schema.Types.ObjectId;

  const moment = require('moment');

  var priceSchema = new mongoose.Schema({
    amount: { type: Number, required: true }, //The volume of the purchase
    price: { type: Number, required: true }, //The USD price of the purchase (price of bitcoin)
    timestamp: { type: String, required: true }, //UNIX timestamp on when the transaction occurred on the exchange
    coin: { type: String, default: 'btc' }, //The coin we are using
    parsedDate: { type: Date }, //The unix timestamp parsed to UTC date object
    fromRealtime: {type: Boolean, default: false} //if its realtime its not to be used for per day data
  });

  priceSchema.pre('save', function(next) {
    this.parsedDate = moment.unix(this.timestamp).utc(); //handle parsing the date to a readable format (when sorting)
    next();
  });

  module.exports.Price = mongoose.model('Price', priceSchema);
}());