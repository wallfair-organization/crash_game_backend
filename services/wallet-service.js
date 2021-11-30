const { WFAIR, casinoContract, WFAIR_TOKEN } = require('../utils/casino-contracts');
const { ONE }  = require('@wallfair.io/trading-engine');
const CASINO_WALLET_ADDR = process.env.WALLET_ADDR || "CASINO";
const WALLET_INITIAL_LIQUIDITY_TO_MINT = 1000000n;

module.exports = {
    getBalance: async (walletAddr) => {
        return (await WFAIR.getBalance(walletAddr)) / ONE;
    },

    placeTrade: async (userId, amount, crashFactor) => {
        await casinoContract.placeTrade(userId.toString(), BigInt(amount) * ONE, crashFactor, process.env.GAME_ID);

        // store an open trade and leave it open for the next game to grab
        console.log(new Date(), `User ${userId} placed traded of ${amount} WFAIR on a crash factor of ${crashFactor}`);
    },

    cancelTrade: async (userId) => {
        // cancels an open trade that hasn't been grabbed yet
        const openTrade = await casinoContract.getOpenTrade(userId, process.env.GAME_ID)
        if(openTrade){
            return casinoContract.cancelTrade(userId, openTrade)
        } else {
            throw 'No open trades to cancel'
        }
        console.log(new Date(), `User ${userId} canceled his trade`);
    },

    lockOpenTrades: async (gameId, gameHash, crashFactor, gameLengthMS, currentHashLine) => {
        await casinoContract.lockOpenTrades(gameId, gameHash, crashFactor, gameLengthMS, currentHashLine);
        // link current waiting trades to game which just started
        console.log(new Date(), `All open trades locked in game ${gameHash}`);
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
    mintInitialBalance: async () => {
        const beneficiary = { owner: CASINO_WALLET_ADDR, namespace: 'cas', symbol: WFAIR_TOKEN };
        console.log(ONE,'ONE')
        await WFAIR.mint(beneficiary, WALLET_INITIAL_LIQUIDITY_TO_MINT * ONE);
    },
    getLastHashLineGameType: async (gameId) => {
        let lastMatch = await casinoContract.getLastMatchByGameType(gameId);
        return lastMatch?.[0].currenthashline;
    }
}
