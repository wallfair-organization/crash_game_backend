const fs = require("fs");
const readline = require("readline");
const crypto = require("crypto");
const path = require("path");

// https://etherscan.io/block/13626940
// Mined by
// public seed
const SEED = process.env.HASH_SEED;
const HASH_FILE_PATH = path.join(__dirname, '../secured/hashes.txt');

if(!SEED) {
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
        .update(SEED)
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

const readHashByLine = (selectedLine, type='current') => {
    const indexBasedOne = --selectedLine;
    let n = indexBasedOne;

    if(type === 'next') {
        n = indexBasedOne + 1;
    } else if (type === 'prev') {
        n = indexBasedOne - 1;
    }

    return new Promise(function(resolve, reject) {
        if (n < 0 || n % 1 !== 0) {
            return reject(new RangeError(`Invalid line number`))
        }

        let current = 0,
            input = fs.createReadStream(HASH_FILE_PATH),
            rl = readline.createInterface({ input })

        rl.on('line', function(line) {
            if (current++ === n) {
                rl.close()
                input.close()
                resolve(line)
            }
        })

        rl.on('error', reject)

        input.on('end', function() {
            reject(new RangeError(
                `Line with index ${n} does not exist in '${HASH_FILE_PATH}.'`
            ))
        })
    })
}



module.exports = {
    readHashByLine,
    crashFactorFromHash
};
