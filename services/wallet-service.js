const wallfair = require("@wallfair.io/wallfair-commons");

//Import sc mock
const { CasinoTradeContract, Erc20 } = require('@wallfair.io/smart_contract_mock');

const CASINO_WALLET_ADDR = process.env.WALLET_ADDR || "CASINO";
const WALLET_INITIAL_LIQUIDITY_TO_MINT = 1000000n;

const WFAIR = new Erc20('WFAIR');
const casinoContract = new CasinoTradeContract(CASINO_WALLET_ADDR);

module.exports = {
    getBalance: async (walletAddr) => {
        return (await WFAIR.balanceOf(walletAddr)) / WFAIR.ONE;
    },

    placeTrade: async (userId, amount, crashFactor) => {
        await casinoContract.placeTrade(userId.toString(), BigInt(amount) * WFAIR.ONE, crashFactor);

        // store an open trade and leave it open for the next game to grab
        console.log(new Date(), `User ${userId} placed traded of ${amount} WFAIR on a crash factor of ${crashFactor}`);
    },

    cancelTrade: async (userId) => {
        // cancels an open trade that hasn't been grabbed yet
        console.log(new Date(), `User ${userId} canceled his trade`);
    },

    lockOpenTrades: async (gameId) => {
        await casinoContract.lockOpenTrades(gameId.toString());
        // link current waiting trades to game which just started 
        console.log(new Date(), `All open trades locked in game ${gameId}`);
    },

    distributeRewards: async (gameId, crashFactor) => {
        console.log(new Date(), `Distribute rewards for all trades on game ${gameId} with a crash factor under ${crashFactor}`)
        
        // give rewards to all winners
        let winners = await casinoContract.rewardWinners(gameId.toString(), crashFactor);

        // return winners, to be used to send notifications
        return winners;
    },

    getCasinoBalance: async () => {
        return module.exports.getBalance(CASINO_WALLET_ADDR);
    },

    mintInitialBalance: async () => {
        await WFAIR.mint(CASINO_WALLET_ADDR, WALLET_INITIAL_LIQUIDITY_TO_MINT * WFAIR.ONE);
    }
}