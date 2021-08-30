// create express server to run game on
const passport = require('passport');
const express = require('express');
const http    = require('http');

const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;

const wallfair = require("@wallfair.io/wallfair-commons");

const { agenda } = require("./schedule-service");

// define constants that can be overriden in .env
const GAME_NAME = process.env.GAME_NAME || "ROSI";
const MAX_AMOUNT_PER_TRADE = process.env.MAX_AMOUNT_PER_TRADE || 100;

// redis publisher used to notify others of updates
var redis;

// wallet service for wallet/blockchain operations
const wallet = require("./wallet-service");

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
    let lastCrashes = await agenda.jobs({name: "crashgame_end"}, {lastFinishedAt: -1}, 10, 0);  
    lastCrashes = lastCrashes.map(lc => lc.attrs.data.crashFactor);

    // read info from redis and send response when the info is ready
    redis.hgetall(GAME_NAME, (err, obj) => {
        res.status(200).send({
            timeStarted: obj.timeStarted,
            nextGameAt: obj.nextGameAt,
            state: obj.state,
            currentBets: ["TODO"],
            lastCrashes: lastCrashes
        });
    });
});

/**
 * Route: Place a trade
 * User must have enough balance to place this trade
 */
server.post('/api/trade', passport.authenticate('jwt', { session: false }), async (req, res) => {
     // TODO validate inputs properly
    let {amount, crashFactor} = req.body;

    // validate amount
    if (amount > MAX_AMOUNT_PER_TRADE) {
        res.status(422).send(`Amount cannot exceed ${MAX_AMOUNT_PER_TRADE}`);
        return;
    }

    // verify that user has enough balance to perform trade
    let balance = await wallet.getBalance(req.user._id.toString());
    if (balance <= amount) {
        res.status(422).send(`User does not have enough balance (${balance}) to perform this operation (${amount})`);
        return;
    }

    try {
        // decrease wallet amount
        await wallet.placeTrade(req.user._id, amount, crashFactor);

        // notify users
        redis.publish('message', JSON.stringify({
            to: GAME_NAME,
            event: "CASINO_TRADE",
            data: {
                amount,
                crashFactor,
                username: req.user.username
            }
        }));

        res.status(200).json({});
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }

    // notify via redis
});

/**
 * Route: Cancel a trade
 */
server.delete('/api/trade', passport.authenticate('jwt', { session: false }), (req, res) => {
    // cancel the trade
    // ensure that proper locking is in place, also when updating balance
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
        appServer.close();
    }
}