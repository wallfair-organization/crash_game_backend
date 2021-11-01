const {CasinoTradeContract} = require("@wallfair.io/smart_contract_mock");
const {publishEvent, notificationEvents} = require("../services/notification-service");

const CASINO_WALLET_ADDR = process.env.WALLET_ADDR || "CASINO";
const casinoContract = new CasinoTradeContract(CASINO_WALLET_ADDR);

const ONE = 10000n;
const GAME_NAME = process.env.GAME_NAME || "ROSI";

const updateCasinoMatches = async () => {
    const matchesToUpdate = await casinoContract.getMatchesForUpdateMissingValues().catch((err) => {
        console.error('getMatchesForUpdateMissingValues failed', err);
    })

    for (const match of matchesToUpdate) {
        const gameHash = match?.gamehash;
        await casinoContract.updateMatchesMissingValues(gameHash).catch((err) => {
            console.error('updateMatchesMissingValues failed', err);
        })
    }
};

const setLostTradesByGameHash = async (gameHash, crashFactor, redis) => {
    const lostTrades = await casinoContract.setLostTrades(gameHash.toString(), crashFactor).catch((err) => {
        console.error('setLostTradesByGameHash failed', err);
    })

    if(lostTrades && lostTrades.length) {
        lostTrades.forEach((trade) => {
            let stakedAmount = parseInt(trade.stakedamount) / Number(ONE);

            const payload = {
                crashFactor,
                gameHash: gameHash,
                gameName: GAME_NAME,
                stakedAmount,
                userId: trade.userid,
            };

            redis.publish('message', JSON.stringify({
                to: trade.userid,
                event: "CASINO_LOST",
                data: payload
            }));

            publishEvent(notificationEvents.EVENT_CASINO_LOST, {
                producer: 'user',
                producerId: trade.userid,
                data: payload,
                broadcast: true
            });
        })
    }

};

exports.updateCasinoMatches = updateCasinoMatches;
exports.setLostTradesByGameHash = setLostTradesByGameHash;
