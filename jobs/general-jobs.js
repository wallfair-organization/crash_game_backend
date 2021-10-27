const {CasinoTradeContract} = require("@wallfair.io/smart_contract_mock");

const CASINO_WALLET_ADDR = process.env.WALLET_ADDR || "CASINO";
const casinoContract = new CasinoTradeContract(CASINO_WALLET_ADDR);

const updateCasinoMatches = async () => {
    const matchesToUpdate = await casinoContract.getMatchesForUpdateMissingValues().catch((err)=> {
        console.error('updateCasinoMatches job err', err);
    })

    for (const match of matchesToUpdate) {
        const gameHash = match?.gamehash;
        await casinoContract.updateMatchesMissingValues(gameHash).catch((err)=> {
            console.error('updateMatchesMissingValues failed', err);
        })
    }
};

exports.updateCasinoMatches = updateCasinoMatches;
