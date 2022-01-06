// create express server to run game on
const passport = require('passport');
const express = require('express');
const http    = require('http');
const cors    = require('cors');
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

const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;

const usersCommonService = require("../../wallfair-commons/services/users");

// redis publisher used to notify others of updates
var redis;

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
                const usersService = usersCommonService.getService();
                const user = await usersService.getUserById(token.userId);
                user._id = user._id || user.userid;
                user.id = user._id || user.userid;

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


