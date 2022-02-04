const redisUtil = require("../utils/redis");
const {roundDecimal} = require("../utils/number-helper");
const {INFO_CHANNEL_EVENTS} = require('../utils/constants');

exports.getCachedPrices = async () => {
  const prices = await redisUtil.hGetAll(INFO_CHANNEL_EVENTS.PRICE_UPDATED_KEY);
  const priceNumbers = {};

  for (let key in prices) {
    if(key !== '_updatedAt') {
      priceNumbers[key] = parseFloat(prices[key])
    } else {
      priceNumbers[key] = prices[key];
    }
  }

  return priceNumbers;
};

exports.convertBalance = async (amount, currency, reverseConversion = false, decimal = 2) => {
  const prices = await this.getCachedPrices();
  const currencyPrice = prices?.[currency];

  let calculated;

  if(reverseConversion) {
    calculated = roundDecimal(amount / currencyPrice || 0, decimal)
  } else {
    calculated = roundDecimal(amount * currencyPrice || 0, decimal)
  }


  return calculated;
};
