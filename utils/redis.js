// Create Redis pub client, which will be used to send out notifications
const { createClient } = require("redis");
const redisClient = createClient({
  url: process.env.REDIS_CONNECTION,
  no_ready_check: false
});

redisClient.on('connect', () => console.log('::> Redis Client Connected'));
redisClient.on('error', (err) => console.error('<:: Redis Client Error', err));

const hGetAll = (key) => {
  return new Promise((resolve, reject) => {
    redisClient.hgetall(key, (err, reply) => {
      if (err) {
        return reject(err);
      }
      resolve(reply);
    });
  });
}

const hSet = (values) => {
  return new Promise((resolve, reject) => {
    redisClient.hset(values, (err, reply) => {
      if (err) {
        return reject(err);
      }
      resolve(reply);
    });
  });
}

module.exports = {
  redis: redisClient,
  hGetAll,
  hSet
}
