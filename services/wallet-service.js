const wallfair = require("@wallfair.io/wallfair-commons");

module.exports = {
    placeTrade: async (userId, amount, crashFactor) => {
        // store an open trade and leave it open for the next game to grab
        console.log(new Date(), `User ${userId} placed traded of ${amount} EVNT on a crash factor of ${crashFactor}`)
    },

    cancelTrade: async (userId) => {
        // cancels an open trade that hasn't been grabbed yet
        console.log(new Date(), `User ${userId} canceled his trade`)
    },

    updateBalance: async (userId, amount) => {
        // distribute reward to a single user by a specific amount
        console.log(new Date(), `User ${userId} was credited ${amount} EVNT`)
    },

    lockOpenTrades: async (gameId) => {
        // link current waiting trades to game which just started 
        console.log(new Date(), `All open trades locked in game ${gameId}`);
    },

    distributeRewards: async (gameId, crashFactor) => {
        // load trades linked to this game (player.crashFactor < game.crashFactor)
        // give rewards to all
        console.log(new Date(), `Distribute rewards for all trades on game ${gameId} with a crash factor under ${crashFactor}`)
    }
}