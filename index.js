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
const { initDb } = require('@wallfair.io/trading-engine');
const { initDatabase } = require('@wallfair.io/wallfair-casino');

// Create Redis pub client, which will be used to send out notifications
const { createClient } = require("redis");
const pubClient = createClient({
    url: process.env.REDIS_CONNECTION,
    no_ready_check: false
});

if(!process.env.GAME_NAME) {
    console.error('No GAME_NAME found. Please specify a unique GAME_NAME as environment variable');
    process.exit(1)
}

if(!process.env.GAME_ID) {
    console.error('No GAME_ID found. Please specify GAME_ID as environment variable (an objectId string)');
    process.exit(1)
}
try {
    mongoose.Types.ObjectId(process.env.GAME_ID)
} catch (e) {
    console.error('GAME_ID should be a valid ObjectId string');
    process.exit(1)
}

const amqp = require('./services/amqp-service');
amqp.init();

/**
 * Main function of this application.
 * Starts the scheduler agent and handles the creation of the first job ever.
 */
(async function () {

    await initDb();
    await initDatabase();

    let mongoURL = process.env.DB_CONNECTION;

    // start mongoose
    await mongoose.connect(mongoURL, {
        useUnifiedTopology: true,
        useNewUrlParser:    true
    });

    // init wallfair commons
    wallfair.initModels(mongoose);

    // mint initial liquidity
    await wallet.transferLiquidity();

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
