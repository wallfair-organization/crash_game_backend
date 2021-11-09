// create express server to run game on
const passport = require('passport');
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const mongoose = require('mongoose')
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

const {fromScaledBigInt} = require('../utils/number-helper')

const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;

const wallfair = require("@wallfair.io/wallfair-commons");
const { notificationEvents } = require("@wallfair.io/wallfair-commons/constants/eventTypes");

const { agenda } = require("./schedule-service");

const amqp = require('./amqp-service');

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
//Import sc mock
const { CasinoTradeContract, Erc20 } = require('@wallfair.io/smart_contract_mock');

const CASINO_WALLET_ADDR = process.env.WALLET_ADDR || "CASINO";
const casinoContract = new CasinoTradeContract(CASINO_WALLET_ADDR);

const WFAIR = new Erc20('WFAIR');

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
    const lastCrashes = lastGames.map(lc => ({
        crashFactor: lc.attrs.data.crashFactor,
        gameHash: lc.attrs.data.gameHash
    }));

    // read info from redis
    const { timeStarted,
        nextGameAt,
        state,
        gameHash,
        animationIndex,
        musicIndex,
        bgIndex
    } = await rdsGet(redis, GAME_ID);

    const {currentBets, upcomingBets, cashedOutBets} = await casinoContract.getBets(gameHash, GAME_ID)
    const userIds = [...currentBets, ...upcomingBets, ...cashedOutBets]
      .map(b => mongoose.Types.ObjectId(b.userid))

    const users = await wallfair.models.User.find({_id: {$in: [...userIds]}}, {username: 1, _id: 1})

    function normalizeBet(bet){
        const user = users.find(u => u._id.toString() === bet.userid)
        return {
            amount: parseInt(bet.stakedamount) / 10000,
            userId: bet.userid,
            crashFactor: parseInt(bet.crashfactor),
            username: user.username
        }
    }

    res.status(200).send({
        timeStarted,
        nextGameAt: state === 'STARTED' ? null : nextGameAt,
        state,
        currentBets: currentBets ? currentBets.map(normalizeBet) : [],
        upcomingBets: upcomingBets ? upcomingBets.map(normalizeBet) : [],
        cashedOutBets: cashedOutBets ? cashedOutBets.map(normalizeBet) : [],
        lastCrashes,
        gameId: gameHash,
        gameHash,
        animationIndex: JSON.parse(animationIndex),
        musicIndex: JSON.parse(musicIndex),
        bgIndex: JSON.parse(bgIndex)
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
        }

        // create notification for channel
        amqp.send('crash_game', 'casino.reward', JSON.stringify({
            to: GAME_ID,
            event: "CASINO_REWARD",
            crashFactor,
            ...pubData
        }))

        // publish message for uniEvent
        amqp.send('universal_events', 'casino.reward', JSON.stringify({
            event: notificationEvents.EVENT_CASINO_CASHOUT,
            producer: 'user',
            producerId: req.user._id,
            data: pubData,
            date: Date.now(),
            broadcast: true
        }))

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
        const game = await rdsGet(redis, GAME_ID);

        // determine if bet is in the current or next game
        const betKey = game.state === 'STARTED' ? 'upcomingBets' : 'currentBets';

        const { upcomingBets = "[]", currentBets = "[]" } = game

        if(game.state === 'STARTED'){
            if (JSON.parse(upcomingBets).find(b => `${b.userId}` === `${req.user._id}`)){
                return res.status(400).send(`Bet already placed for user ${req.user.username}`)
            }
        } else {
            if (JSON.parse(currentBets).find(b => `${b.userId}` === `${req.user._id}`)){
               return res.status(400).send(`Bet already placed for user ${req.user.username}`)
            }
        }

        // decrease wallet amount
        await wallet.placeTrade(req.user._id, amount, crashFactor);

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
        amqp.send('crash_game', 'casino.trade', JSON.stringify({
            to: GAME_ID,
            event: "CASINO_TRADE",
            gameName: GAME_NAME,
            ...pubData
        }))

        // publish message for uniEvent
        amqp.send('universal_events', 'casino.trade', JSON.stringify({
            event: notificationEvents.EVENT_CASINO_PLACE_BET,
            producer: 'user',
            producerId: req.user._id,
            data: pubData,
            date: Date.now(),
            broadcast: true
        }))

        //dont wait for this one, do this in the backround
        userService.checkTotalGamesPlayedAward(req.user._id.toString(), {
            gameTypeId: GAME_ID,
            gameName: GAME_NAME
        }).catch((err)=> {
            console.error('checkTotalGamesPlayedAward', err)
        })

        res.status(200).json({});
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

/**
 * Route: Cancel a trade
 */
server.delete('/api/trade', passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
        await wallet.cancelTrade(`${req.user._id}`)
        const {upcomingBets = "[]", currentBets = "[]", state} = await rdsGet(redis, GAME_ID);

        if(state === "STARTED"){
            const bets = JSON.parse(upcomingBets).filter(b => `${b.userId}` !== `${req.user._id}`)
            redis.hmset([GAME_ID, 'upcomingBets', JSON.stringify(bets)]);
        } else {
            const bets = JSON.parse(currentBets).filter(b => `${b.userId}` !== `${req.user._id}`)
            redis.hmset([GAME_ID, 'currentBets', JSON.stringify(bets)]);
        }

        const pubData = {
            gameTypeId: GAME_ID,
            gameName: GAME_NAME,
            username: req.user.username,
            userId: req.user._id,
            updatedAt: Date.now()
        };



        // notify users
        amqp.send('crash_game', 'casino.cancel', JSON.stringify({
            to: GAME_ID,
            event: "CASINO_CANCEL",
            ...pubData
        }))

        // publish message for uniEvent
        amqp.send('universal_events', 'casino.cancel', JSON.stringify({
            event: notificationEvents.EVENT_CASINO_CANCEL_BET,
            producer: 'user',
            producerId: req.user._id,
            data: pubData,
            broadcast: true,
            date: Date.now()
        }))

        res.status(200).send()
    } catch (err){
        console.error(err);
        res.status(500).send(err);
    }
});


/**
 * Get matches
 */

server.get('/api/matches', async (req, res) => {
    try {
        const {
            page = 1,
            perPage = 10
        } = req.query;
        const matches = await casinoContract.getMatches(page, perPage, GAME_ID);
        return res.status(200)
          .send(matches)
    } catch (err) {
        console.log('QUERY:', req.query);
        console.log(err);
        res.status(500).send(err);
    }
})

/**
 * Get match details based on gameHash, including all bets from casino_trades
 */

server.get('/api/matches/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const match = await casinoContract.getMatchByHash(hash);
        const bets = await casinoContract.getAllTradesByGameHash(hash);
        return res.status(200).send({
            match: match ? match[0] : {},
            bets
        });
    } catch (err) {
        console.log("PARAMS:", req.params);
        console.log(err);
        res.status(500).send(err);
    }
})

/**
 * Get next game based on current gameHash
 */

server.get('/api/matches/:hash/next', async (req, res) => {
    try {
        const { hash } = req.params;
        const nextMatch = await casinoContract.getNextMatchByGameHash(hash, GAME_ID);
        const match = nextMatch ? nextMatch[0] : {};

        const bets = await casinoContract.getAllTradesByGameHash(match?.gamehash);
        return res.status(200).send({
            match,
            bets
        });
    } catch (err) {
        console.log("PARAMS:", req.params);
        console.log(err);
        res.status(500).send(err);
    }
})

/**
 * Get prev game based on current gameHash
 */

server.get('/api/matches/:hash/prev', async (req, res) => {
    try {
        const { hash } = req.params;
        const nextMatch = await casinoContract.getPrevMatchByGameHash(hash, GAME_ID);
        const match = nextMatch ? nextMatch[0] : {};

        const bets = await casinoContract.getAllTradesByGameHash(match?.gamehash);
        return res.status(200).send({
            match,
            bets
        });
    } catch (err) {
        console.log("PARAMS:", req.params);
        console.log(err);
        res.status(500).send(err);
    }
})

/**
 * Get luckies wins in last week
 */

server.get('/api/trades/lucky', async (req, res) => {
    try {
        const trades = await casinoContract.getLuckyWins(24*7, 20, GAME_ID);

        if(trades && trades.length) {
            const userIds = [...trades].map(b => mongoose.Types.ObjectId(b.userid));
            const users = await wallfair.models.User.find({_id: {$in: [...userIds]}}, {username: 1, _id: 1})

            trades.map((item) => {
                const user = users.find(u => u._id.toString() === item.userid);
                const stakedAmount = item.stakedamount;
                item.stakedamount = fromScaledBigInt(stakedAmount);
                item.username = user?.username;
                return item;
            })
        }
        return res.status(200)
          .send(trades);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
})

/**
 * Get high wins in last week
 */

server.get('/api/trades/high', async (req, res) => {
    try {
        const trades = await casinoContract.getHighWins(24*7, 20, GAME_ID);

        if(trades && trades.length) {
            const userIds = [...trades].map(b => mongoose.Types.ObjectId(b.userid));
            const users = await wallfair.models.User.find({_id: {$in: [...userIds]}}, {username: 1, _id: 1})

            trades.map((item) => {
                const user = users.find(u => u._id.toString() === item.userid);
                const stakedAmount = item.stakedamount;
                item.stakedamount = fromScaledBigInt(stakedAmount);
                item.username = user?.username;
                return item;
            })
        }
        return res.status(200)
          .send(trades);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
})

/**
 * Get some global stats by range
 */

server.get('/api/globalstats/:range', async (req, res) => {
    try {
        const {type, range} = req.params;
        let output = {};

        const getHours = (range) => {
            const rangeInt = parseInt(range);
            if (range.indexOf('w') > -1) {
                return rangeInt * (24 * 7)
            }

            if (range.indexOf('all') > -1) {
                return 0;
            }

            return rangeInt;
        }

        const convertedRange = getHours(range);
        const countBets = await casinoContract.countTradesByLastXHours(convertedRange);

        output['trades'] = parseInt(countBets?.[0].totaltrades);
        output['volume'] = parseInt(fromScaledBigInt(countBets?.[0].totalvolume));
        output['range'] = convertedRange === 0 ? 'all time' : `last ${range}`;

        return res.status(200)
            .send(output);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
})


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


