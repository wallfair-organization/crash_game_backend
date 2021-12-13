// import configs from .env file
const dotenv = require('dotenv');
dotenv.config();

const crypto = require("crypto");

const {SECRET_HASHES} = require('../utils/constants');

//ELON GAME
//Hash from BTC block #XXXXX.
// https://www.blockchain.com/btc/block/713947
// AS
// public seed
// 0000000000000000000b67781ed2770ccf35c15006de5df06efa99a65323b82f
//-----------------------------
//PUMP DUMP GAME
//Hash from BTC block #XXXXX.
// https://www.blockchain.com/btc/block/713946
// AS
// public seed
// 0000000000000000000b4984b5442f1059816a4065fa0f21cbf61d816dc2fa64
const PUBLIC_SEED = process.env.HASH_SEED;
const SERVER_SEED_SECRET = process.env.SERVER_SEED_SECRET;

if (!SERVER_SEED_SECRET) {
  throw new Error('SERVER_SEED_SECRET must be set!');
}

if (!PUBLIC_SEED) {
  throw new Error('HASH_SEED is empty. Please define it as env variable.')
}

const divisible = (hash, mod) => {
  // We will read in 4 hex at a time, but the first chunk might be a bit smaller
  // So ABCDEFGHIJ should be chunked like  AB CDEF GHIJ
  var val = 0;

  var o = hash.length % 4;
  for (var i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
    val = ((val << 16) + parseInt(hash.substring(i, i + 4), 16)) % mod;
  }

  return val === 0;
}

const crashFactorFromHash = (crashHash) => {
  const hash = crypto
    .createHmac("sha256", crashHash)
    .update(PUBLIC_SEED)
    .digest("hex");


// this is the house edge of 5%
  const hs = parseInt(100 / 5);
  if (divisible(hash, hs)) {
    return 1;
  }

  const h = parseInt(hash.slice(0, 52 / 4), 16);
  const e = Math.pow(2, 52);

  return Math.floor((100 * e - h) / (e - h)) / 100.0;
}

const readHashByFileLine = (selectedLine, type = 'current') => {
  const indexBasedOne = --selectedLine;
  let n = indexBasedOne;

  if (type === 'next') {
    n = indexBasedOne + 1;
  } else if (type === 'prev') {
    n = indexBasedOne - 1;
  }

  return new Promise(function (resolve, reject) {
    if (n < 0 || n % 1 !== 0) {
      return reject(new RangeError(`Invalid line number`))
    }

    let current = 0,
      input = fs.createReadStream(HASH_FILE_PATH),
      rl = readline.createInterface({input})

    rl.on('line', function (line) {
      if (current++ === n) {
        rl.close()
        input.close()
        resolve(line)
      }
    })

    rl.on('error', reject)

    input.on('end', function () {
      reject(new RangeError(
        `Line with index ${n} does not exist in '${HASH_FILE_PATH}.'`
      ))
    })
  })
}

const readHashByMemoryLine = (selectedLine, type = 'current') => {
  const indexBasedOne = --selectedLine;
  let n = indexBasedOne;

  if (type === 'next') {
    n = indexBasedOne + 1;
  } else if (type === 'prev') {
    n = indexBasedOne - 1;
  }

  const hash = SECRET_HASHES[n];

  if(!hash) {
    throw new Error('[readHashByMemoryLine] cant get hash from memory..');
  }

  return hash;
}

const generateHash = (seed) => {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

const generateListOfHashes = (totalHashes = 5) => {
  lastGame = totalHashes;
  lastHash = generateHash(SERVER_SEED_SECRET);

  // IMPORTANT: Order of the hashes. Last GameID has the first hash dubbed lastHash. First GameID has last hash of the hash chain!
  // arr.push([lastGame, lastHash]); // Write to database
  SECRET_HASHES.push(lastHash); // Write to database

  for (let i = 1; i < totalHashes; i++) {
    // var gameNumber = totalHashes - i;
    hash = generateHash(SECRET_HASHES[i - 1]);
    SECRET_HASHES.push(hash);
  }

  //must be reversed, we are reading it from the end
  return SECRET_HASHES.reverse();
}

//just for GENESIS_SECRET
const generateInitialRandomHex = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  readHashByFileLine,
  readHashByMemoryLine,
  crashFactorFromHash,
  generateListOfHashes
};
