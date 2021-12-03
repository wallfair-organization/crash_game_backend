const {
    CasinoTradeContract,
    initDatabase
} = require('@wallfair.io/wallfair-casino');
const { Wallet } = require('@wallfair.io/trading-engine');
const CASINO_WALLET_ADDR = process.env.CASINO_WALLET_ADDR || 'CASINO';
const WFAIR_TOKEN = 'WFAIR'

//for now just one instance for all games
let _wallet = null;
const getWallet = async () => {
    if (!_wallet) {
        _wallet = new Wallet();
    }
    return _wallet;
};

let _casinoContract = null;
const getCasinoContract = async () => {
    if (!_casinoContract) {
        await initDatabase();
        _casinoContract = new CasinoTradeContract(CASINO_WALLET_ADDR);
    }
    return _casinoContract;
};

module.exports = {
    CASINO_WALLET_ADDR,
    getWallet,
    getCasinoContract,
    WFAIR_TOKEN
}
