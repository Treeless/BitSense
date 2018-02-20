(function() {
  // Price model for storing the price of the coin
  var mongoose = require('mongoose');
  var ObjectId = mongoose.Schema.Types.ObjectId;

  const moment = require('moment');

  var priceSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    price: { type: Number, required: true },
    coin: { type: String, default: 'btc' },
    uniq_id: { type: String, index: { unique: true }, required: true },
    timestamp: { type: String, required: true },
    parsedDate: { type: Date },
    exchange: {type: String , default: "bitstamp"}, //The exchange this data was gathered from
  });

  priceSchema.pre('save', function(next) {
    this.parsedDate = moment.unix(this.timestamp).utc(); //handle parsing the date to a readable format (when sorting)
    next();
  });

  module.exports.Price = mongoose.model('Price', priceSchema);
}());