//Import sc mock
const { getWallet, getCasinoContract, CASINO_WALLET_ADDR, WFAIR_TOKEN } = require("../utils/casino-contracts");
const { ONE }  = require('@wallfair.io/trading-engine');
const { CASINO_TRADE_STATE } = require('@wallfair.io/wallfair-casino');
const { default: BigNumber } = require("bignumber.js");
const WALLET_INITIAL_LIQUIDITY_TO_MINT = 1000000n;

module.exports = {
    getBalance: async (walletAddr) => {
        const WFAIR = await getWallet();
        const balance = await WFAIR.getBalance(walletAddr);
        console.log("balance: ", balance, walletAddr)
        return new BigNumber(balance).dividedBy(ONE.toString());
    },
    placeTrade: async (userId, amount, crashFactor, gameId) => {
        const casinoContract = await getCasinoContract();
        await casinoContract.placeTrade(userId.toString(), BigInt(amount) * ONE, crashFactor, gameId);

        // store an open trade and leave it open for the next game to grab
        console.log(new Date(), `User ${userId} placed traded of ${amount} WFAIR on a crash factor of ${crashFactor}`);
    },
    placeTradeHash: async (userId, amount, gameHash, crashFactor, gameId) => {
      const casinoContract = await getCasinoContract();
      await casinoContract.placeTradeHash(userId.toString(), BigInt(amount*100) * WFAIR.ONE/100n, gameHash, crashFactor, gameId);
      // store an open trade and leave it open for the next game to grab
      console.log(new Date(), `User ${userId} placed traded of ${amount} WFAIR on a crash factor of ${crashFactor}`);
    },
    placeSingleGameTrade: async (userId, amount, multiplier, gameId, gameHash, riskFactor) => {
        const casino_state = multiplier > 0 ? CASINO_TRADE_STATE.WIN : CASINO_TRADE_STATE.LOSS;
        const casinoContract = await getCasinoContract();
        await casinoContract.placeSingleGameTrade(userId.toString(), BigInt(amount) * WFAIR.ONE, multiplier, gameId, casino_state, gameHash, riskFactor, fairnessId, fairnessNonce);
        console.log(new Date(), `User ${userId} placed single trade of ${amount} WFAIR on multiplier of ${multiplier}. Trade state: ${casino_state}`);
    },
    setLostTrades: async (gameHash, crashFactor) => {
        const casinoContract = await getCasinoContract();
        await casinoContract.setLostTrades(gameHash, crashFactor);
        console.log(new Date(), `SetLostTrades ${gameHash}`);
    },
    setLostTradesExternal: async (gameHash, crashFactor) => {
        const casinoContract = await getCasinoContract();
        await casinoContract.setLostTradesExternal(gameHash, crashFactor);
        console.log(new Date(), `SetLostTrades ${gameHash}`);
    },
    cancelTrade: async (userId, gameId) => {
        // cancels an open trade that hasn't been grabbed yet
        const casinoContract = await getCasinoContract();
        const openTrade = await casinoContract.getOpenTrade(userId, gameId)
        console.log("canceltrade", openTrade)
        if(openTrade){
            return casinoContract.cancelTrade(userId, openTrade)
        } else {
            throw 'No open trades to cancel'
        }
        console.log(new Date(), `User ${userId} canceled his trade`);
    },
    attemptCashout: async (userWalletAddr, crashFactor, gameHash) => {
        const casinoContract = await getCasinoContract();
        console.log(new Date(), `Attempt cashout for gameHash ${gameHash}, crashFactor ${crashFactor}, user ${userWalletAddr}`);
        let result = await casinoContract.cashout(userWalletAddr, crashFactor, gameHash);
        return result;
    },
    distributeRewards: async (gameHash, crashFactor) => {
      console.log(new Date(), `Distribute rewards for all trades on game ${gameHash} with a crash factor under ${crashFactor}`)
      const casinoContract = await getCasinoContract();
      // give rewards to all winners
      let winners = await casinoContract.rewardWinners(gameHash, crashFactor);

      // return winners, to be used to send notifications
      return winners;
    },
    getCasinoBalance: async () => {
        return module.exports.getBalance(CASINO_WALLET_ADDR);
    },
    mintInitialBalance: async () => {
        const WFAIR = await getWallet();
        const BaseWallet = { owner: CASINO_WALLET_ADDR, namespace: 'cas', symbol: WFAIR_TOKEN };
        await WFAIR.mint(BaseWallet, WALLET_INITIAL_LIQUIDITY_TO_MINT * ONE);
    },
    getLastHashLineGameType: async (gameId) => {
      const casinoContract = await getCasinoContract();
      let lastMatch = await casinoContract.getLastMatchByGameType(gameId);
      return lastMatch?.[0].currenthashline;
    },
    lockOpenTrades: async (gameId, gameHash, crashFactor, gameLengthMS, currentHashLine) => {
      const casinoContract = await getCasinoContract();
      await casinoContract.lockOpenTrades(gameId, gameHash, crashFactor, gameLengthMS, currentHashLine);
      // link current waiting trades to game which just started
      console.log(new Date(), `All open trades locked in game ${gameHash}`);
    }
}
