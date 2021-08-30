// create scheduling tool
const Agenda = require("agenda");
const agenda = new Agenda({ db: { address: process.env.DB_CONNECTION } });

// define constants that can be overriden in .env
const GAME_INTERVAL_IN_SECONDS = process.env.GAME_INTERVAL_IN_SECONDS || 5;
const GAME_NAME = process.env.GAME_NAME || "ROSI";
const GAUSSIAN_MEAN = parseFloat(process.env.GAUSSIAN_MEAN || 0.0);
const GAUSSIAN_STDEV = parseFloat(process.env.GAUSSIAN_STDEV || 0.1);

// import gaussian function
const gaussian = require("@wallfair.io/wallfair-commons").utils.getGaussian(GAUSSIAN_MEAN, GAUSSIAN_STDEV);

// redis publisher used to notify others of updates
var redis;

// wallet service for wallet/blockchain operations
const wallet = require("./wallet-service");

const ONE = 10000n;

/**
 * Method for starting the game.
 * This method decides the crash factor, and schedules the end of the game.
 */
 agenda.define("crashgame_start", { lockLifetime: 10000 }, async (job) => {
    /*if (Math.random() > 0.5) {
        console.log(new Date(), "crashgame_start will fail on purpose!");

        // 50% chance if failure
        throw new Error("FAIL!")
    }*/

    // use the id of this job as gameId
    let gameId = job.attrs._id;

    /// log the start of the game for debugging purposes
    console.log(new Date(), `Next game is starting with an id of ${gameId}`);

    // decides on a crash factor
    let crashFactor = gaussian();
    let nextGameTime = Math.ceil(crashFactor);

    // log the chosen parameters for debugging purposes
    console.log(new Date(), `The game ${gameId} will crash with a factor of ${crashFactor} in ${nextGameTime} seconds`);

    // lock open trades to this particular game
    await wallet.lockOpenTrades(gameId);

    // schedules the end of the game
    agenda.schedule(`in ${nextGameTime} seconds`, "crashgame_end", {
        createdAt: new Date(),
        crashFactor,
        gameId
    });

    // notify others that game started
    redis.publish('message', JSON.stringify({
        to: GAME_NAME,
        event: "CASINO_START",
        data: {
            gameId: job.attrs._id,
            gameName: GAME_NAME
        }
    }));

    // change redis state of the game
    redis.hmset([GAME_NAME, 
        "state", "STARTED", 
        "timeStarted", new Date().toISOString()]);
});

/**
 * Method for ending the game.
 * This method must notify all players that game is over and update their balances
 * It also needs to schedule the start of the next game
 */
agenda.define("crashgame_end", {lockLifetime: 10000}, async (job) => {
    /*if (Math.random() > 0.5) {
        console.log(new Date(), "crashgame_end will fail on purpose!");

        // 50% chance if failure
        throw new Error("FAIL!")
    }*/

    // extract needed information from the job
    let {crashFactor, gameId} = job.attrs.data;
    
    // log start of next game for debugging purposes
    console.log(new Date(), `Game ${gameId} crashed now. Next game starts in ${GAME_INTERVAL_IN_SECONDS} seconds`);

    // end game and update balanes
    let winners = await wallet.distributeRewards(gameId, crashFactor);

    // schedules the next game
    let startJob = await agenda.schedule(`in ${GAME_INTERVAL_IN_SECONDS} seconds`, "crashgame_start", {
        createdAt: new Date()
    });
    let nextGameAt = startJob.attrs.nextRunAt;

    // notify others that game ended
    redis.publish('message', JSON.stringify({
        to: GAME_NAME,
        event: "CASINO_END",
        data: {
            crashFactor,
            gameId,
            gameName: GAME_NAME
        }
    }));

    // change redis state of the game
    redis.hmset([GAME_NAME, 
        "state", "ENDED", 
        "nextGameAt", nextGameAt]);


    // notifies about wins
    winners.forEach((winner) => {
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
                reward
            }
        }));
    });
});

/**
 * This function will capture any error and re-schedule the job.
 * For now, jobs are being re-scheduled for 2 seconds after failure.
 * TODO: Decision: Stop at a certain failCount instead of keep trying forever?
 */
 agenda.on('fail', async (err, job) => {
    // log error on console with reason
    console.log(new Date(), "FAILURE DETECTED.", err);

    // try again in 2 seconds
    //job.schedule("in 5 seconds");
    //await job.save();

    // log that recovery was successfully scheduled
    //console.log(new Date(), "Recovery for job will be attempted now.")
});

module.exports = {
    init: async (_redis) => {
        redis = _redis;

        // start the agenda engine
        await agenda.start();

        // check if there are jobs created or if this is the first run ever
        const jobs = await agenda.jobs({}, {"data.createdAt": -1}, 1, 0);

        // create first job ever
        if (jobs.length == 0) {
            agenda.schedule(`in ${GAME_INTERVAL_IN_SECONDS} seconds`, "crashgame_start", {
                createdAt: new Date()
            });

            console.log(new Date(), "First job scheduled");
        } else if (jobs[0].attrs.failedAt) {
            console.log(new Date(), "Last job appears to need recovery from failure. Attemping it now.")
            jobs[0].schedule("in 2 seconds");
            await jobs[0].save();
        }
    },

    stop: async () => {
        await agenda.stop();
    },

    agenda
}