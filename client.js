// import configs from .env file
const dotenv = require('dotenv');
dotenv.config();

const GAME_ID = process.env.GAME_ID;

// Create Redis pub and sub clients
const { createClient } = require("redis");

const subClient = createClient({
    url: process.env.REDIS_CONNECTION,
    no_ready_check: false
});

subClient.on("message", (channel, message) => {
    console.log(new Date(), channel, message);
});

subClient.subscribe(GAME_ID);
console.log("Subscribing to topic ", GAME_ID)

subClient.subscribe("message");
console.log("Subscribing to topic ", "message")

for (let i = 2; i < process.argv.length; i++) {
    console.log("Subscribing to topic ", process.argv[i])
        subClient.subscribe(process.argv[i]);
}
