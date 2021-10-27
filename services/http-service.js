// create express server to run game on
const passport = require('passport');
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const { rdsGet } = require('../utils/redis');
const corsOptions = {
    origin: ["wallfair.io",
        /\.wallfair\.io$/,
        /\.ngrok\.io$/,
        /\.netlify\.app$/,
        /localhost:?.*$/m,
    ],
    credentials: true,
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'X-Access-Token',
        'Authorization',
    ],
    exposedHeaders: ['Content-Length'],
    preflightContinue: false,
}

const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;

const wallfair = require("@wallfair.io/wallfair-commons");

const { agenda } = require("./schedule-service");
const { publishEvent, notificationEvents } = require('./notification-service')

const crashUtils = require("../utils/crash_utils");

// define constants that can be overriden in .env
const GAME_NAME = process.env.GAME_NAME || "ROSI";
const GAME_ID = process.env.GAME_ID || '614381d74f78686665a5bb76';
const MAX_AMOUNT_PER_TRADE = process.env.MAX_AMOUNT_PER_TRADE ? parseInt(process.env.MAX_AMOUNT_PER_TRADE) : 10000;

// redis publisher used to notify others of updates
var redis;

// wallet service for wallet/blockchain operations
const wallet = require("./wallet-service");
const walletService = require('./wallet-service');
const userService = require('./user-service');

// configure passport to use JWT strategy with KEY provide via environment variable
// the secret key must be the same as the one used in the main application
passport.use('jwt',
    new JWTstrategy(
        {
            secretOrKey: process.env.JWT_KEY,
            jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken()
        },
        async (token, done) => {
            try {
                let user = await wallfair.models.User.findById(token.userId).exec();
                return done(null, user);
            } catch (error) {
                done(error);
            }
        }
    )
);

// Initialise server using express
const server = express();

// TODO restrict access to fe app host
server.use(cors(corsOptions));

// Giving server ability to parse json
server.use(express.json());

// configure server to use passport
server.use(passport.initialize());
server.use(passport.session());

/**
 * Route: Health Check
 */
server.get('/', (req, res) => {
    res.status(200).send({
        message: 'Blockchain meets Prediction Markets made Simple. - Wallfair.io',
    });
});

/**
 * Route: Get current game information
 */
server.get('/api/current', async (req, res) => {
    // retrieve the last 10 jobs and extract crashFactor from them
    const lastGames = await agenda.jobs({name: "crashgame_end"}, {lastFinishedAt: -1}, 10, 0);
    const lastCrashes = lastGames.map(lc => lc.attrs.data.crashFactor);

    // read info from redis
    const { timeStarted,
        nextGameAt,
        state,
        currentBets,
        upcomingBets,
        gameHash,
        cashedOutBets,
        animationIndex,
        musicIndex,
        bgIndex,
    } = await rdsGet(redis, GAME_ID);

    res.status(200).send({
        timeStarted,
        nextGameAt: state === 'STARTED' ? null : nextGameAt,
        state,
        currentBets: currentBets ? JSON.parse(currentBets) : [],
        upcomingBets: upcomingBets ? JSON.parse(upcomingBets) : [],
        cashedOutBets: cashedOutBets ? JSON.parse(cashedOutBets) : [],
        lastCrashes,
        gameId: gameHash,
        gameHash,
        animationIndex: JSON.parse(animationIndex),
        musicIndex: JSON.parse(musicIndex),
        bgIndex: JSON.parse(bgIndex),
        ts: Date.now()
    });
});

server.post('/api/cashout', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const { timeStarted, gameHash, currentCrashFactor, cashedOutBets } = await rdsGet(redis, GAME_ID);

        let b = timeStarted.split(/\D+/);
        let startedAt = Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5], b[6]);

        const now = Date.now();
        let timeDiff = now - startedAt;
        let crashFactor = crashUtils.calculateCrashFactor(timeDiff);

        console.log(new Date(), "CASHOUT", req.user.username, crashFactor, currentCrashFactor, timeDiff, timeStarted, gameHash);

        if (+crashFactor > +currentCrashFactor) {
            console.debug(`[DEBUG] Cashout crash factor was ${crashFactor} but the current crashFactor was ${currentCrashFactor}`);
            res.status(500).send(`Too late. Your crash factor was ${crashFactor} but the current crashFactor was ${currentCrashFactor}`);
            return;
        }

        let { totalReward, stakedAmount } = await walletService.attemptCashout(req.user._id.toString(), crashFactor, gameHash);

        const pubData = {
            crashFactor,
            gameId: gameHash,
            gameHash,
            gameTypeId: GAME_ID,
            gameName: GAME_NAME,
            stakedAmount: parseInt(stakedAmount.toString()) / 10000,
            reward: parseInt(totalReward.toString()) / 10000,
            userId: req.user._id,
            username: req.user.username,
            updatedAt: Date.now()
        };

        // create notification for channel
        redis.publish('message', JSON.stringify({
            to: GAME_ID,
            event: "CASINO_REWARD",
            data: pubData
        }));

        // save and publish message for uniEvent
        publishEvent(notificationEvents.EVENT_CASINO_CASHOUT, {
            producer: 'user',
            producerId: req.user._id,
            data: pubData,
            broadcast: true
        });

        let user = await wallfair.models.User.findById({ _id: req.user._id }, { amountWon: 1 }).exec();
        if (user) {
            user.amountWon += parseInt(totalReward.toString()) / 10000;
            await user.save();
        }

        const existingBets = !!cashedOutBets ? JSON.parse(cashedOutBets) : [];

        // push new bet to existing bets
        const bets = [
            ...existingBets,
            {
                gameId: gameHash,
                gameHash,
                amount: parseInt(totalReward.toString()) / 10000,
                stakedAmount: parseInt(stakedAmount.toString()) / 10000,
                crashFactor,
                username: req.user.username,
                userId: req.user._id
            }
        ];

        // update storage
         redis.hmset([GAME_ID, 'cashedOutBets', JSON.stringify(bets)]);

        res.status(200).json({
            crashFactor,
            gameId: gameHash,
            gameHash,
            gameName: GAME_NAME,
            stakedAmount: parseInt(stakedAmount.toString()) / 10000,
            reward: parseInt(totalReward.toString()) / 10000,
        });
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

/**
 * Route: Place a trade
 * User must have enough balance to place this trade
 */
server.post('/api/trade', passport.authenticate('jwt', { session: false }), async (req, res) => {
     // TODO validate inputs properly
    let {amount, crashFactor} = req.body;

    // validate amount
    if (+amount > MAX_AMOUNT_PER_TRADE) {
        res.status(422).send(`Amount cannot exceed ${MAX_AMOUNT_PER_TRADE}`);
        return;
    }

    if(+amount < 1){
        res.status(422).send(`Amount should be at least 1`);
        return;
    }

    if(+crashFactor < 1){
        res.status(422).send(`Crash factor should be higher than 1`);
        return;
    }

    // verify that user has enough balance to perform trade
    let balance = await wallet.getBalance(req.user._id.toString());

    if (balance < BigInt(amount)) {
        res.status(422).send(`User does not have enough balance (${balance}) to perform this operation (${amount})`);
        return;
    }

    try {
        // decrease wallet amount
        await wallet.placeTrade(req.user._id, amount, crashFactor);

        const pubData = {
            gameTypeId: GAME_ID,
            gameName: GAME_NAME,
            amount,
            crashFactor,
            username: req.user.username,
            userId: req.user._id,
            updatedAt: Date.now()
        };

        // notify users
        redis.publish('message', JSON.stringify({
            to: GAME_ID,
            event: "CASINO_TRADE",
            data: pubData
        }));

        // save and publish message for uniEvent
        publishEvent(notificationEvents.EVENT_CASINO_PLACE_BET, {
            producer: 'user',
            producerId: req.user._id,
            data: pubData,
            broadcast: true
        });

        //dont wait for this one, do this in the backround
        userService.checkTotalGamesPlayedAward(req.user._id.toString(), {
            gameTypeId: GAME_ID,
            gameName: GAME_NAME
        }).catch((err)=> {
            console.error('checkTotalGamesPlayedAward', err)
        })

        const game = await rdsGet(redis, GAME_ID);

        // determine if bet is in the current or next game
        const betKey = game.state === 'STARTED' ? 'upcomingBets' : 'currentBets';

        // initalize current or upcoming bets if empty
        const existingBets = !!game[betKey] ? JSON.parse(game[betKey]) : [];

        // push new bet to existing bets
        const bets = [
            ...existingBets,
            {
                amount,
                crashFactor,
                username: req.user.username,
                userId: req.user._id
            }
        ];

        // update storage
        redis.hmset([GAME_ID, betKey, JSON.stringify(bets)]);

        res.status(200).json({});
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

/**
 * Route: Cancel a trade
 */
server.delete('/api/trade', passport.authenticate('jwt', { session: false }), (req, res) => {
    // cancel the trade
    // ensure that proper locking is in place, also when updating balance
    // TODO implement this
});

// Export methods to start/stop app server
var appServer;
module.exports = {
    init: (_redis) => {
        redis = _redis;

        // create http server and start it
        let httpServer  = http.createServer(server);
        appServer = httpServer.listen(process.env.PORT || 8001, () => {
            const port = appServer.address().port;
            console.log(`Wallfair Crash Game API runs on port: ${port}`);
        });
    },

    stop: () => {
        if (appServer) {
            appServer.close();
        }
    }
}
