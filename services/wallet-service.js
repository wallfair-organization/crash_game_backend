//Import sc mock
const { casinoContract, CASINO_WALLET_ADDR } = require("../utils/casino-contracts");
const { Wallet, AccountNamespace, BN }  = require('@wallfair.io/trading-engine');

const CASINO_WALLET = process.env.CASINO_WALLET;
const WFAIR_SYMBOL = 'WFAIR';
const {GAMES_REF_PERCENT_REWARD} = require('../utils/constants');

module.exports = {
    distributeRewards: async (gameHash, crashFactor) => {
      console.log(new Date(), `Distribute rewards for all trades on game ${gameHash} with a crash factor under ${crashFactor}`)
      // give rewards to all winners
      let winners = await casinoContract.rewardWinners(gameHash, crashFactor);

      // return winners, to be used to send notifications
      return winners;
    },
    getLastHashLineGameType: async (gameId) => {
      let lastMatch = await casinoContract.getLastMatchByGameType(gameId);
      return lastMatch?.[0].currenthashline;
    },
    lockOpenTrades: async (gameId, gameHash, crashFactor, gameLengthMS, currentHashLine) => {
      await casinoContract.lockOpenTrades(gameId, gameHash, crashFactor, gameLengthMS, currentHashLine);
      // link current waiting trades to game which just started
      console.log(new Date(), `All open trades locked in game ${gameHash}`);
    },
    transferLiquidity: async () => {
        const wallet = new Wallet();
        const ethBalance = await wallet.getBalance(CASINO_WALLET, AccountNamespace.ETH);
        console.log(new Date(), `Casino eth balance loaded with ${ethBalance} WFAIR`);

        if (new BN(ethBalance).isGreaterThan(0)) {
            await wallet.transfer(
                {
                    owner: CASINO_WALLET,
                    namespace: AccountNamespace.ETH,
                    symbol: WFAIR_SYMBOL
                },
                {
                    owner: CASINO_WALLET_ADDR,
                    namespace: AccountNamespace.CAS,
                    symbol: WFAIR_SYMBOL
                },
                ethBalance
            );
        } else {
            const casinoBalance = await wallet.getBalance(CASINO_WALLET_ADDR, AccountNamespace.CAS);
            console.log('Current casino balance ', casinoBalance);
            if (new BN(casinoBalance).isLessThanOrEqualTo(0)) {
                console.error(new Date(), 'Casino wallet is out of tokens. Quitting gracefully...');
                process.exit(0);
            }
        }
    }
}
