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
        "alpacasino.io",
        /\.alpacasino\.io$/,
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
const userService = require('./user-service');
//Import sc mock
const { casinoContract } = require('../utils/casino-contracts');

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


