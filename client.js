// import configs from .env file
const dotenv = require('dotenv');
dotenv.config();

const GAME_NAME = process.env.GAME_NAME || "ROSI";

// Create Redis pub and sub clients
const { createClient } = require("redis");

const subClient = createClient({
    url: process.env.REDIS_CONNECTION,
    no_ready_check: false
});

subClient.on("message", (channel, message) => {
    console.log(new Date(), channel, message);
});

subClient.subscribe(GAME_NAME);

