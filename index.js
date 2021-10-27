// import configs from .env file
const dotenv = require('dotenv');
dotenv.config();

// create scheduling service
const scheduler = require("./services/schedule-service");

// create application server
const appServer = require("./services/http-service");

// import wallet service
const wallet = require("./services/wallet-service");

// init commons and mongoose
const mongoose = require('mongoose');
const wallfair = require('@wallfair.io/wallfair-commons');

// Create Redis pub client, which will be used to send out notifications
const { createClient } = require("redis");
const pubClient = createClient({
    url: process.env.REDIS_CONNECTION,
    no_ready_check: false
});

const amqp = require('./services/amqp-service');
amqp.init();

/**
 * Main function of this application.
 * Starts the scheduler agent and handles the creation of the first job ever.
 */
(async function () {
    let mongoURL = process.env.DB_CONNECTION;

    // start mongoose
    await mongoose.connect(mongoURL, {
        useUnifiedTopology: true,
        useNewUrlParser:    true
    });

    // init wallfair commons
    wallfair.initModels(mongoose);

    // load casino balance
    let casinoBalance = await wallet.getCasinoBalance();
    console.log(new Date(), `Casino balance loaded with ${casinoBalance} WFAIR`);
    
    // mint initial liquidity if casino balance is 0. 
    // (Balance should never reach 0 again)
    if (casinoBalance == 0) {
        await wallet.mintInitialBalance();
    }

    // init http server
    console.log(new Date(), "Initializing app server.")
    appServer.init(pubClient);

    // init scheduling service
    console.log(new Date(), "Initializing scheduler");
    await scheduler.init(pubClient);

    // log to console for debugging purposes
    console.log(new Date(), "All systems ready to start crashing!");
})();

// exits gracefully
// this will wait for the current running job to finish
async function graceful() {
    console.log(new Date(), "Quitting gracefully...");

    await scheduler.stop();
    appServer.stop();
    process.exit(0);
}
process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);