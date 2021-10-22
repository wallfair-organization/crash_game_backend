const models = require("@wallfair.io/wallfair-commons").models;
const _ = require('lodash');

/***
 * Get how many times user played the game by userId
 * @param userId
 * @param gameId
 * @returns {Promise<number>}
 */
const getCasinoGamePlayCount = async (userId, gameId) => {
  const filter = {
    type: 'Casino/CASINO_PLACE_BET',
    userId
  };

  if (gameId) {
    filter['data.gameTypeId'] = gameId;
  }

  return models.UniversalEvent.countDocuments(filter);
};

/***
 * Get how many times user cashout-ed in game
 * @param userId
 * @param gameId
 * @returns {Promise<number>}
 */
const getCasinoGameCashoutCount = async (userId, gameId) => {
  const filter = {
    type: 'Casino/CASINO_CASHOUT',
    userId
  };

  if (gameId) {
    filter['data.gameTypeId'] = gameId;
  }

  return models.UniversalEvent.countDocuments(filter);
};

/***
 * Get total amount won by user
 * @param userId
 * @param gameId
 * @returns {Promise<object>}
 * object.totalWon
 * object.totalReward
 * object.totalStaked
 */
const getCasinoGamesAmountWon = async (userId, gameId) => {
  const defaultOutput = {
    totalWon: 0,
    totalReward: 0,
    totalStaked: 0
  };

  const filter = {
    type: 'Casino/CASINO_CASHOUT',
    userId
  };

  if (gameId) {
    filter['data.gameTypeId'] = gameId;
  }

  const query = await models.UniversalEvent.aggregate([
    {
      $match: filter
    },
    {
      $group: {
        _id: null,
        totalReward: {$sum: "$data.reward"},
        totalStaked: {$sum: "$data.stakedAmount"}
      },
    }, {
      $project: {
        _id: 0,
        totalWon: {"$subtract": ["$totalReward", "$totalStaked"]},
        totalReward: 1,
        totalStaked: 1
      }
    }]).catch((err) => {
    console.error(err);
  });

  return _.get(query, 0) || defaultOutput;
};

/***
 * Get total amount lost by user
 * @param userId
 * @param gameId - gameTypeId
 * @returns {Promise<number>} - return negative value, when user lost in general
 */
const getCasinoGamesAmountLost = async (userId, gameId) => {
  const matchFilter = {
    type: 'Casino/CASINO_PLACE_BET',
    userId
  };

  if(gameId) {
    matchFilter['data.gameTypeId'] = gameId;
  }

  const queryTotalBetted = await models.UniversalEvent.aggregate([
    {
      $match: matchFilter
    },
    {
      $group: {
        _id: null,
        totalBettedAmount: {$sum: "$data.amount"}
      },
    }, {
      $project: {
        _id: 0,
        totalBettedAmount: 1
      }
    }]).catch((err) => {
    console.error(err);
  });

  const queryTotalRewarded = await getCasinoGamesAmountWon(userId, gameId).catch((err) => {
    console.error(err);
  });
  const totalBetted = parseFloat(_.get(queryTotalBetted, '0.totalBettedAmount', 0));

  if (queryTotalRewarded && queryTotalBetted) {
    const totalRewarded = parseFloat(_.get(queryTotalRewarded, 'totalReward', 0));
    return totalRewarded - totalBetted;
  } else {
    return -totalBetted;
  }
};

module.exports = {
  getCasinoGamePlayCount,
  getCasinoGameCashoutCount,
  getCasinoGamesAmountWon,
  getCasinoGamesAmountLost
};
