//Import sc mock
const { casinoContract, CASINO_WALLET_ADDR } = require("../utils/casino-contracts");
const { ONE, Wallet, AccountNamespace, BN }  = require('@wallfair.io/trading-engine');
const { CASINO_TRADE_STATE } = require('@wallfair.io/wallfair-casino');

const CASINO_WALLET = process.env.CASINO_WALLET;
const WFAIR_SYMBOL = 'WFAIR';
const {GAMES_REF_PERCENT_REWARD} = require('../utils/constants');

module.exports = {
    getBalance: async (walletAddr) => {
        const balance = await new Wallet().getBalance(walletAddr);
        console.log("balance: ", balance, walletAddr)
        return new BN(balance).dividedBy(ONE.toString());
    },
    placeTrade: async (userId, amount, crashFactor, gameId) => {
        await casinoContract.placeTrade(userId.toString(), BigInt(amount) * ONE, crashFactor, gameId);

        // store an open trade and leave it open for the next game to grab
        console.log(new Date(), `User ${userId} placed traded of ${amount} WFAIR on a crash factor of ${crashFactor}`);
    },
    placeTradeHash: async (userId, amount, gameHash, crashFactor, gameId) => {
      await casinoContract.placeTradeHash(userId.toString(), BigInt(amount*100) * WFAIR.ONE/100n, gameHash, crashFactor, gameId);
      // store an open trade and leave it open for the next game to grab
      console.log(new Date(), `User ${userId} placed traded of ${amount} WFAIR on a crash factor of ${crashFactor}`);
    },
    placeSingleGameTrade: async (userId, amount, multiplier, gameId, gameHash, riskFactor) => {
        const casino_state = multiplier > 0 ? CASINO_TRADE_STATE.WIN : CASINO_TRADE_STATE.LOSS;
        await casinoContract.placeSingleGameTrade(userId.toString(), BigInt(amount) * WFAIR.ONE, multiplier, gameId, casino_state, gameHash, riskFactor, fairnessId, fairnessNonce);
        console.log(new Date(), `User ${userId} placed single trade of ${amount} WFAIR on multiplier of ${multiplier}. Trade state: ${casino_state}`);
    },
    setLostTrades: async (gameHash, crashFactor) => {
        await casinoContract.setLostTrades(gameHash, crashFactor);
        console.log(new Date(), `SetLostTrades ${gameHash}`);
    },
    setLostTradesExternal: async (gameHash, crashFactor) => {
        await casinoContract.setLostTradesExternal(gameHash, crashFactor);
        console.log(new Date(), `SetLostTrades ${gameHash}`);
    },
    cancelTrade: async (userId, gameId) => {
        // cancels an open trade that hasn't been grabbed yet
        const openTrade = await casinoContract.getOpenTrade(userId, gameId)
        console.log("canceltrade", openTrade)
        if(openTrade){
            console.log(new Date(), `User ${userId} canceled his trade`);
            return casinoContract.cancelTrade(userId, openTrade)
        } else {
            throw 'No open trades to cancel'
        }
    },
    attemptCashout: async (userWalletAddr, crashFactor, gameHash) => {
        console.log(new Date(), `Attempt cashout for gameHash ${gameHash}, crashFactor ${crashFactor}, user ${userWalletAddr}`);
        let result = await casinoContract.cashout(userWalletAddr, crashFactor, gameHash);
        return result;
    },
    distributeRewards: async (gameHash, crashFactor) => {
      console.log(new Date(), `Distribute rewards for all trades on game ${gameHash} with a crash factor under ${crashFactor}`)
      // give rewards to all winners
      let winners = await casinoContract.rewardWinners(gameHash, crashFactor);

      // return winners, to be used to send notifications
      return winners;
    },
    getCasinoBalance: async () => {
        return module.exports.getBalance(CASINO_WALLET_ADDR);
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
    },
    transferRefRewards: async (userId, amount) => {
      const wallet = new Wallet();
      const rewardPercent = parseFloat(GAMES_REF_PERCENT_REWARD) / 100;
      const amountForRefUser = new BN(amount).multipliedBy(rewardPercent).toString();

      if (new BN(amountForRefUser).isGreaterThan(0)) {
        await wallet.transfer(
          {
            owner: CASINO_WALLET,
            namespace: AccountNamespace.CAS,
            symbol: WFAIR_SYMBOL
          },
          {
            owner: userId,
            namespace: AccountNamespace.USR,
            symbol: WFAIR_SYMBOL
          },
          amountForRefUser
        );
      }
    }
}
