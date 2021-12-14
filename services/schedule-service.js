// create scheduling tool
const Agenda = require("agenda");
const agenda = new Agenda({ db: { address: process.env.DB_CONNECTION, collection: `${process.env.GAME_NAME}_jobs` } });
const _ = require('lodash');

const { ONE } = require('@wallfair.io/trading-engine');
const {fromScaledBigInt} = require('../utils/number-helper');

const { rdsGet } = require('../utils/redis');

if(!process.env.GAME_ID) throw 'No GAME_ID found. Please specify GAME_ID as environment variable'
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
// rabbitmq service
const amqp = require('./amqp-service');

const GAME_ID = process.env.GAME_ID;

//Import sc mock
const { casinoContract } = require('../utils/casino-contracts');

const { notificationEvents } = require("@wallfair.io/wallfair-commons/constants/eventTypes");
const mongoose = require("mongoose");
const wallfair = require("@wallfair.io/wallfair-commons");

const {readHashByMemoryLine, crashFactorFromHash} = require('../utils/hash_utils');
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


    const jobs = await agenda.jobs({"name": "crashgame_start", "data.prevGame": prevGame}, {"data.createdAt": 1}, 1, 0);
    console.log(new Date(), "crashgame_start", jobs.length);

    if (jobs[0].attrs._id.toString() !== job.attrs._id.toString()) {
        console.log(new Date(), "crashgame_start", `Job ${job.attrs._id.toString()} will skip execution`, jobs[0].attrs._id.toString());
        return; // does nothing in this case
    }

    //End job already specified, do nothing
    if(job.attrs.data.endJob) {
        console.log(new Date(), "crashgame_start", `Job ${job.attrs._id.toString()} will skip execution intentionally`);
        return;
    }

    const lastHashLine = await wallet.getLastHashLineGameType(GAME_ID).catch((err) => {
        console.error(`getLastMatchByGameType failed`, err);
    });

    const currentHashLine = lastHashLine ? lastHashLine+1 : 1;

     //average time to find very last record = 1.2352231789994985
     const hashByLine = await readHashByMemoryLine(currentHashLine);

     const currentCrashFactor = crashFactorFromHash(hashByLine);

     // decides on a crash factor
     let crashFactor = currentCrashFactor || -1;
     console.log(new Date(), '[PROVABLY_FAIR] fileHashLine', currentHashLine);
     console.log(new Date(), '[PROVABLY_FAIR] hash', hashByLine);
     console.log(new Date(), '[PROVABLY_FAIR] crashFactor', crashFactor);

     if (crashFactor < 1) {
         crashFactor = 1;
     }

     if (crashFactor > 100) {
         crashFactor = 100;
     }

    //gameHash should be hash from file, instead just id from agenda
    const gameHash = hashByLine;
    let gameLengthMS = crashUtils.totalDelayTime(crashFactor);

    // log the start of the game for debugging purposes
    console.log(new Date(), `Next game is starting with an id of ${gameHash}`);

    // log the chosen parameters for debugging purposes
    console.log(new Date(), `The game ${gameHash} will crash with a factor of ${crashFactor} in ${gameLengthMS / 1000} seconds`);

    // lock open trades to this particular game
    await wallet.lockOpenTrades(GAME_ID, gameHash.toString(), crashFactor, gameLengthMS, currentHashLine);
    let nextGameStartTime = new Date(Date.now() + gameLengthMS);

     // schedules the end of the game
     const endJob = await agenda.schedule(nextGameStartTime, "crashgame_end", {
         createdAt: new Date(),
         crashFactor,
         gameHash // TODO: make frontend use gameHash
     });
     job.attrs.data.endJob = endJob.attrs._id
     await job.save()

   const animationIndex = Math.floor(Math.random() * 3);
   const musicIndex = Math.floor(Math.random() * 2);
   const bgIndex = Math.floor(Math.random() * 5);

    // notify others that game started
    amqp.send('crash_game', 'casino.start', JSON.stringify({
        to: GAME_ID,
        event: "CASINO_START",
        gameId: gameHash,
        gameHash,
        gameName: GAME_NAME,
        animationIndex,
        musicIndex,
        bgIndex,
        "timeStarted": timeStarted.toISOString()
    }))

    // change redis state of the game
    redis.hmset([GAME_ID,
        "state", "STARTED",
        "gameHash", gameHash.toString(),
        "animationIndex", JSON.stringify(animationIndex),
        "musicIndex", JSON.stringify(musicIndex),
        "bgIndex", JSON.stringify(bgIndex),
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
    let {crashFactor, gameHash} = job.attrs.data;

    // ensure the game ends only once
    const jobs = await agenda.jobs({"name": "crashgame_end", "data.gameHash": gameHash}, {"data.createdAt": 1}, 1, 0);

    console.log(new Date(), "crashgame_end", jobs.length);

    if (jobs[0].attrs._id.toString() !== job.attrs._id.toString()) {
        console.log(new Date(), "crashgame_end", `Job ${job.attrs._id.toString()} will skip execution`, jobs[0].attrs._id.toString());
        return; // does nothing in this case
    }

    // log start of next game for debugging purposes
    console.log(new Date(), `Game ${gameHash} crashed now. Next game starts in ${GAME_INTERVAL_IN_SECONDS} seconds`);

    // Ensure another process won't create the same crashgame_start job
    if (job.attrs.data.nextStartJob){
        console.log(new Date(), "crashgame_end", `Job ${job.attrs._id.toString()} will skip execution intentionally`)
        return;
    }

    // end game and update balances
    // DISABLED FOR NOW
    // let winners = await wallet.distributeRewards(gameHash, crashFactor);

    // schedules the next game
    // if rewards are not distributed we won't have next game scheduled
    let startJob = await agenda.schedule(`in ${GAME_INTERVAL_IN_SECONDS} seconds`, "crashgame_start", {
        createdAt: new Date(),
        prevGame: gameHash
    });
    job.attrs.data.nextStartJob = startJob.attrs._id
    await job.save()

    let nextGameAt = startJob.attrs.nextRunAt;

    // notify others that game ended
    amqp.send('crash_game', 'casino.end', JSON.stringify({
        to: GAME_ID,
        event: "CASINO_END",
        nextGameAt,
        crashFactor,
        gameId: gameHash,
        gameName: GAME_NAME
    }))

    // extract next game bets
    const { upcomingBets = "[]"} = await rdsGet(redis, GAME_ID);

    // change redis state of the game
    redis.hmset([GAME_ID,
        "state", "ENDED",
        "nextGameAt", nextGameAt,
        "currentBets", upcomingBets,
        "upcomingBets", "[]",
        "cashedOutBets", "[]",
        "gameHash", "",
        "currentCrashFactor", ""
    ]);

    //init single agenda job for current game close
    await agenda.schedule("in 2 seconds", ["game_close"], {crashFactor, gameHash});
});

/**
 * This method will trigger in the background, after each game ends
 */
agenda.define("game_close", async (job) => {
    const {gameHash, crashFactor} = job.attrs.data;
    //Set proper state (3) and crash factor for all lost user trades in casino_trades table
    const lostTrades = await casinoContract.setLostTrades(gameHash.toString(), crashFactor).catch((err) => {
        console.error(`setLostTradesByGameHash failed ${gameHash}`, err);
    })

    const lostTradesArr = lostTrades?.[0];

    if(lostTradesArr && lostTradesArr.length) {
        const userIds = [...lostTradesArr].map(b => mongoose.Types.ObjectId(b.userid));
        const users = await wallfair.models.User.find({_id: {$in: [...userIds]}}, {username: 1, ref: 1, _id: 1})


      for (const trade of lostTradesArr) {
        let stakedAmount = fromScaledBigInt(trade.stakedamount);
        const user = users.find(u => u._id.toString() === trade.userid);
        const ref = user?.ref || null;

        const payload = {
          crashFactor,
          gameHash: gameHash,
          gameName: GAME_NAME,
          gameTypeId: GAME_ID,
          stakedAmount,
          userId: trade.userid,
          username: user?.username,
          updatedAt: Date.now()
        };

        amqp.send('crash_game', 'casino.lost', JSON.stringify({
          to: GAME_ID,
          event: "CASINO_LOST",
          ...payload
        }))

        // publish message for uniEvent
        amqp.send('universal_events', 'casino.lost', JSON.stringify({
          event: notificationEvents.EVENT_CASINO_LOST,
          producer: 'user',
          producerId: payload.userId,
          data: payload,
          date: Date.now(),
          broadcast: true
        }))
      }
    }

    //Calculate proper values: amountinvestedsum, amountrewardedsum, numtrades, numcashouts and set them in casino_matches table
    const matchesToUpdate = await casinoContract.getMatchesForUpdateMissingValues().catch((err) => {
        console.error('getMatchesForUpdateMissingValues failed', err);
    })

    for (const match of matchesToUpdate) {
        const gameHash = match?.gamehash;
        await casinoContract.updateMatchesMissingValues(gameHash).catch((err) => {
            console.error('updateMatchesMissingValues failed', err);
        })
    }
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
            jobs[0].schedule("in 2 seconds");
            await jobs[0].save();
        }
    },

    stop: async () => {
        await agenda.stop();
    },

    agenda
}
