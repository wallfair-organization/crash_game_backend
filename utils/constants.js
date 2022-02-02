const WFAIR_REWARDS = {
  //total games played to token reward amount
  totalGamesPlayed: {
      5: 100,
      20: 200,
      40: 400,
      60: 1000,
      100: 1500
  }
};

const SECRET_HASHES = [];

const GAMES_REF_PERCENT_REWARD = 20;

const INFO_CHANNEL_NAME = 'INFO_CHANNEL';
const INFO_KEY_PREFIX = `${INFO_CHANNEL_NAME}/`;

const INFO_CHANNEL_EVENTS = {
  PRICE_UPDATED_KEY: `${INFO_KEY_PREFIX}PRICE_UPDATED`
};

module.exports = {
  WFAIR_REWARDS,
  SECRET_HASHES,
  GAMES_REF_PERCENT_REWARD,
  INFO_CHANNEL_EVENTS
};
