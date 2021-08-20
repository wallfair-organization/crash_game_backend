// import configs from .env file
const dotenv = require('dotenv');
dotenv.config();

// define constants that can be overriden in .env
const GAME_INTERVAL_IN_SECONDS = process.env.GAME_INTERVAL_IN_SECONDS || 5;
const GAME_NAME = process.env.GAME_NAME || "ROSI";

// create express server to run game on
const express = require('express');
const http    = require('http');

// create scheduling tool
const Agenda = require("agenda");
const agenda = new Agenda({ db: { address: process.env.DB_CONNECTION } });

/**
 * Method for starting the game.
 * This method decides the crash factor, and schedules the end of the game.
 */
agenda.define("crashgame_start", { lockLifetime: 10000 }, async (job) => {
    if (Math.random() > 0.5) {
        console.log(new Date(), "crashgame_start will fail on purpose!");

        // 50% chance if failure
        throw new Error("FAIL!")
    }

    /// log the start of the game for debugging purposes
    console.log(new Date(), "Next game is starting");

    // decides on a crash factor
    // TODO: choose better method
    let crashFactor = Math.random() * 10;
    let nextGameTime = Math.ceil(crashFactor);

    // log the chosen parameters for debugging purposes
    console.log(new Date(), `The game will crash with a factor of ${crashFactor} in ${nextGameTime} seconds`);

    // schedules the end of the game
    agenda.schedule(`in ${nextGameTime} seconds`, "crashgame_end", {
        createdAt: new Date(),
        crashFactor,
        gameId: job.attrs._id
    });

    // notify others that game started
    pubClient.publish(GAME_NAME, JSON.stringify({
        action: "GAME_START",
        gameId: job.attrs._id
    }));
});

/**
 * Method for ending the game.
 * This method must notify all players that game is over and update their balances
 * It also needs to schedule the start of the next game
 */
agenda.define("crashgame_end", {lockLifetime: 10000}, async (job) => {
    if (Math.random() > 0.5) {
        console.log(new Date(), "crashgame_end will fail on purpose!");

        // 50% chance if failure
        throw new Error("FAIL!")
    }
    
    // log start of next game for debugging purposes
    console.log(new Date(), `Game crashed now. Next game starts in ${GAME_INTERVAL_IN_SECONDS} seconds`);

    // schedules the next game
    agenda.schedule(`in ${GAME_INTERVAL_IN_SECONDS} seconds`, "crashgame_start", {
        createdAt: new Date()
    });

    // notify others that game ended
    pubClient.publish(GAME_NAME, JSON.stringify({
        action: "GAME_END",
        crashFactor: job.attrs.data.crashFactor,
        gameId: job.attrs.data.gameId
    }));
});

// Create Redis pub client, which will be used to send out notifications
const { createClient } = require("redis");
const pubClient = createClient({
    url: process.env.REDIS_CONNECTION,
    no_ready_check: false
});

/**
 * This function will capture any error and re-schedule the job.
 * For now, jobs are being re-scheduled for 2 seconds after failure.
 * TODO: Stop at a certain failCount instead of keep trying forever?
 */
agenda.on('fail', async (err, job) => {
    // log error on console with reason
    console.log(new Date(), "FAILURE DETECTED.", err.message);

    // try again in 2 seconds
    job.schedule("in 2 seconds");
    await job.save();

    // log that recovery was successfully scheduled
    console.log(new Date(), "Recovery for job will be attempted now.")
});

/**
 * Main function of this application.
 * Starts the scheduler agent and handles the creation of the first job ever.
 */
(async function () {
    // start the agenda engine
    await agenda.start();

    // check if there are jobs created or if this is the first run ever
    const jobs = await agenda.jobs({}, {"data.createdAt": -1}, 1, 0);
    console.log(JSON.stringify(jobs))
    
    // create first job ever
    if (jobs.length == 0) {
        agenda.schedule(`in ${GAME_INTERVAL_IN_SECONDS} seconds`, "crashgame_start", {
            createdAt: new Date()
        });

        console.log(new Date(), "First job scheduled");
    } 
})();

// exits gracefully
// this will wait for the current running job to finish
async function graceful() {
    console.log(new Date(), "Quitting gracefully...");

    await agenda.stop();
    process.exit(0);
}
process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);