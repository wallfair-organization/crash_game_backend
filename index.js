// import configs from .env file
const dotenv = require('dotenv');
dotenv.config();

// create scheduling service
const scheduler = require("./services/schedule-service");

// create application server
const appServer = require("./services/http-service");

// init commons and mongoose
const mongoose = require('mongoose');
const wallfair = require('@wallfair.io/wallfair-commons');

// Create Redis pub client, which will be used to send out notifications
const { createClient } = require("redis");
const pubClient = createClient({
    url: process.env.REDIS_CONNECTION,
    no_ready_check: false
});

/**
 * Main function of this application.
 * Starts the scheduler agent and handles the creation of the first job ever.
 */
(async function () {
    // start mongoose
    await mongoose.connect(process.env.DB_CONNECTION, {
        useUnifiedTopology: true,
        useNewUrlParser:    true,
    });

    // init wallfair commons
    wallfair.init(mongoose);

    // init http server
    appServer.init(pubClient);

    // init scheduling service
    await scheduler.init(pubClient);

    // log to console for debugging purposes
    console.log(new Date(), "All systems ready to start crashing!");
})();

// exits gracefully
// this will wait for the current running job to finish
async function graceful() {
    console.log(new Date(), "Quitting gracefully...");

    appServer.stop();
    await scheduler.stop();
    process.exit(0);
}
process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);