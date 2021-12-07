const {
    CasinoTradeContract,
} = require('@wallfair.io/wallfair-casino');

const CASINO_WALLET_ADDR = process.env.CASINO_WALLET_ADDR || 'CASINO';
const casinoContract = new CasinoTradeContract(CASINO_WALLET_ADDR);

module.exports = {
    CASINO_WALLET_ADDR,
    casinoContract,
}
