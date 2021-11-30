const {
    CasinoTradeContract
} = require('@wallfair.io/wallfair-casino');
const { Wallet } = require('@wallfair.io/trading-engine');
const CASINO_WALLET_ADDR = process.env.CASINO_WALLET_ADDR || 'CASINO';
const WFAIR_TOKEN = 'WFAIR'

//for now just one instance for all games
const WFAIR = new Wallet();

const casinoContract = new CasinoTradeContract();

module.exports = {
    CASINO_WALLET_ADDR,
    WFAIR,
    casinoContract,
    WFAIR_TOKEN
}
