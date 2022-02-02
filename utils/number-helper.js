const _ = require("lodash");
const { ONE, BN }  = require('@wallfair.io/trading-engine');

const toScaledBigInt = (input) => {
  return BigInt(new BN(input).times(ONE).decimalPlaces(0));
};

const fromScaledBigInt = (input) => {
  return new BN(input).dividedBy(ONE).toFixed(2);
};

const calculateGain = (investmentAmount, outcomeAmount, precision = 2) => {
  const investment = _.toNumber(investmentAmount);
  const outcome = _.toNumber(outcomeAmount);
  const gain = ((outcome - investment) / investment) * 100;

  const negative = gain < 0;
  const value = isNaN(gain) ? '-' : negative ? `${gain.toFixed(precision)}%` : `+${gain.toFixed(precision)}%`;

  return {
    number: gain,
    value,
    negative,
  };
};

const roundDecimal = (amount, decimal = 2) => {
  return +(Math.round(amount + `e+${decimal}`)  + `e-${decimal}`);
}

const getProfit = (stakedAmount, multiplier) => {
  const parseMulti = parseFloat(multiplier);
  return roundDecimal((stakedAmount * parseMulti) - stakedAmount);
}

module.exports = {
  toScaledBigInt,
  fromScaledBigInt,
  calculateGain,
  getProfit,
  roundDecimal
};
