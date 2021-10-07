// create scheduling tool
const Agenda = require("agenda");
const agenda = new Agenda({ db: { address: process.env.DB_CONNECTION } });

const { rdsGet } = require('../utils/redis');

// define constants that can be overriden in .env
const GAME_INTERVAL_IN_SECONDS = process.env.GAME_INTERVAL_IN_SECONDS || 5;
const GAME_NAME = process.env.GAME_NAME || "ROSI";
const GAUSSIAN_MEAN = parseFloat(process.env.GAUSSIAN_MEAN || 0.0);
const GAUSSIAN_STDEV = parseFloat(process.env.GAUSSIAN_STDEV || 0.1);

// import gaussian function
const gaussian = require("@wallfair.io/wallfair-commons").utils
    .getGaussian(parseFloat(GAUSSIAN_MEAN), parseFloat(GAUSSIAN_STDEV));
// import length of gam

const crashUtils = require("../utils/crash_utils");

// redis publisher used to notify others of updates
var redis;

// wallet service for wallet/blockchain operations
const wallet = require("./wallet-service");

const ONE = 10000n;
const GAME_ID = process.env.GAME_ID || '614381d74f78686665a5bb76';

/**
 * Method for starting the game.
 * This method decides the crash factor, and schedules the end of the game.
 */
 agenda.define("crashgame_start", { lockLifetime: 10000 }, async (job) => {
    // if (Math.random() > 0.5) {
    //     console.log(new Date(), "crashgame_start will fail on purpose!", job.attrs._id);
    //
    //     // 50% chance if failure
    //     throw new Error("FAIL!")
    // }

    let timeStarted = job.attrs.lastRunAt;

     // ensure only one game is starting from the previous game
     let {prevGame} = job.attrs.data;

     // use the id of this job as gameId
     let gameId = job.attrs._id;
    const jobs = await agenda.jobs({"name": "crashgame_start", "data.prevGame": prevGame}, {"data.createdAt": 1}, 1, 0);
    console.log(new Date(), "crashgame_start", jobs.length);

    if (jobs[0].attrs._id.toString() !== job.attrs._id.toString()) {
        console.log(new Date(), "crashgame_start", `Job ${job.attrs._id.toString()} will skip execution`, jobs[0].attrs._id.toString());
        return; // does nothing in this case
    }

    //End job already specified, do nothing
    if(job.attrs.data.endJob) return;
     // decides on a crash factor
     let crashFactor = gaussian() * 10;

     // debug 
     console.log("Crash factor decided", crashFactor);

    if (crashFactor < 1) {
        
        var bit = Math.random() < 0.4; // samples true with prob .4
        
        if (bit) {
            crashFactor = Math.max(1, gaussian() * 10);
        } else {
            crashFactor = 1;
        }

    } 
    
    let gameLengthSeconds = Math.floor(crashUtils.totalDelayTime(crashFactor) / 1000);
    

    // debug 
    console.log("Crash factor total time ", gameLengthSeconds);

    // log the start of the game for debugging purposes
    console.log(new Date(), `Next game is starting with an id of ${gameId}`);

    // log the chosen parameters for debugging purposes
    console.log(new Date(), `The game ${gameId} will crash with a factor of ${crashFactor} in ${gameLengthSeconds} seconds`);

    // lock open trades to this particular game
    await wallet.lockOpenTrades(gameId);
     // schedules the end of the game
     const endJob = await agenda.schedule(`in ${gameLengthSeconds} seconds`, "crashgame_end", {
         createdAt: new Date(),
         crashFactor,
         gameId
     });
     job.attrs.data.endJob = endJob.attrs._id
     await job.save()


    // notify others that game started
    redis.publish('message', JSON.stringify({
        to: GAME_ID,
        event: "CASINO_START",
        data: {
            gameId: job.attrs._id,
            gameName: GAME_NAME,
            "timeStarted": timeStarted.toISOString()
        }
    }));

    // change redis state of the game
    redis.hmset([GAME_ID,
        "state", "STARTED",
        "gameId", gameId.toString(),
        "currentCrashFactor", crashFactor + "",
        "timeStarted", timeStarted.toISOString()]);
});





/**
 * Method for ending the game.
 * This method must notify all players that game is over and update their balances
 * It also needs to schedule the start of the next game
 */
agenda.define("crashgame_end", {lockLifetime: 10000}, async (job) => {
    // if (Math.random() > 0.5) {
    //     console.log(new Date(), "crashgame_end will fail on purpose!", job.attrs._id);
    //     // 50% chance if failure
    //     throw new Error("FAIL!")
    // }

    // extract needed information from the job
    let {crashFactor, gameId} = job.attrs.data;

    // ensure the game ends only once
    const jobs = await agenda.jobs({"name": "crashgame_end", "data.gameId": gameId}, {"data.createdAt": 1}, 1, 0);

    console.log(new Date(), "crashgame_end", jobs.length);

    if (jobs[0].attrs._id.toString() !== job.attrs._id.toString()) {
        console.log(new Date(), "crashgame_end", `Job ${job.attrs._id.toString()} will skip execution`, jobs[0].attrs._id.toString());
        return; // does nothing in this case
    }

    // log start of next game for debugging purposes
    console.log(new Date(), `Game ${gameId} crashed now. Next game starts in ${GAME_INTERVAL_IN_SECONDS} seconds`);

    // Ensure another process won't create the same crashgame_start job
    if(job.attrs.data.nextStartJob) return;

    // end game and update balances
    // DISABLED FOR NOW
    // let winners = await wallet.distributeRewards(gameId, crashFactor);

    // schedules the next game
    // if rewards are not distributed we won't have next game scheduled
    let startJob = await agenda.schedule(`in ${GAME_INTERVAL_IN_SECONDS} seconds`, "crashgame_start", {
        createdAt: new Date(),
        prevGame: gameId
    });
    job.attrs.data.nextStartJob = startJob.attrs._id
    await job.save()

    let nextGameAt = startJob.attrs.nextRunAt;

    // notify others that game ended
    redis.publish('message', JSON.stringify({
        to: GAME_ID,
        event: "CASINO_END",
        data: {
            nextGameAt,
            crashFactor,
            gameId,
            gameName: GAME_NAME
        }
    }));

    // extract next game bets
    const { upcomingBets } = await rdsGet(redis, GAME_ID);

    // notifies about wins
    // DISABLED FOR NOW
    /*winners.forEach((winner) => {
        let reward = Number(winner.reward) / Number(ONE);
        let stakedAmount = parseInt(winner.stakedamount) / Number(ONE);

        redis.publish('message', JSON.stringify({
            to: winner.userid,
            event: "CASINO_REWARD",
            data: {
                crashFactor,
                gameId,
                gameName: GAME_NAME,
                stakedAmount,
                reward,
                userId: winner.userid,
            }
        }));
    });*/


    // change redis state of the game
    redis.hmset([GAME_ID,
        "state", "ENDED",
        "nextGameAt", nextGameAt,
        "currentBets", upcomingBets,
        'upcomingBets', '[]',
        "gameId", "",
        "currentCrashFactor", ""
    ], () => {});
});

/**
 * This function will capture any error and re-schedule the job.
 * For now, jobs are being re-scheduled for 2 seconds after failure.
 * TODO: Decision: Stop at a certain failCount instead of keep trying forever?
 */
 agenda.on('fail', async (err, job) => {
    // log error on console with reason
    console.log(new Date(), `Failure detected for job ${job.attrs._id}.`, err);
    if(job.attrs.data.endJob || job.attrs.data.nextStartJob) return;
    // try again in 2 seconds
    job.schedule("in 2 seconds");
    await job.save();

    // log that recovery was successfully scheduled
    console.log(new Date(), `Recovery for job ${job.attrs._id} will be attempted now.`)
});

module.exports = {
    init: async (_redis) => {
        redis = _redis;

        // start the agenda engine
        await agenda.start();

        // check if there are jobs created or if this is the first run ever
        const jobs = await agenda.jobs({}, {"data.createdAt": -1}, 1, 0);

        // create first job ever
        if (jobs.length === 0) {
            agenda.schedule(`in ${GAME_INTERVAL_IN_SECONDS} seconds`, "crashgame_start", {
                createdAt: new Date(),
                prevGame: "root"
            });

            console.log(new Date(), "First job scheduled");
        } else if (jobs[0].attrs.failedAt) {
            console.log(new Date(), "Last job appears to need recovery from failure. Attemping it now.")
            jobs[0].schedule("in 2 seconds");
            await jobs[0].save();
        } else {
            console.log(jobs)
        }
    },

    stop: async () => {
        await agenda.stop();
    },

    agenda
}
