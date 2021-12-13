# Wallfair Crash Game

## Introduction

This backend contains the backend functionality for the Wallfair Crash Game.
The main functions are as follows:
 - Start first game ever
 - Start function
    - Decides on crash factor
    - Notifies users that game started
    - Schedules the end function
 - End function
    - Notifies listeners that game ended
    - Schedules the next start function
 - Handle failures and job retries
 - Handle concurrency with locks

## Provably fair algorithm

### Current 10 000 000 (secured/hashes.txt) based on block:
Current max rows in file is: `2,147,483,647` (INT type which we are using for PG)
```
https://etherscan.io/block/13626940
Mined by #HASH
PUBLIC SEED
```

### How to generate hashes for development use
1. Pull latest @wallfair/commons package https://github.com/wallfair-organization/wallfair-commons
2. Create a file to store hashes at `wallfair-commons/scripts/provably-fair/output/hashes.txt`
3. Run `wallfair-commons/scripts/provably-fair/generateHashes` with GENESIS_SECRET environment variable specified.
4. Copy `hashes.txt` to `crash_game_backend/secured`
5. put HASH_SEED in .env, its public seed will be used for crash-factor calculation / verification (jsfiddle):
   Currently used public seeds:
      - Elon game: 0xea674fdde714fd979de3edf0f56aa9716b898ec8
      - Pump and dump: 0x45a36a8e118c37e4c47ef4ab827a7c9e579e11e2

## API

### Obtain current info

```
REQUEST:
GET/api/current

RESPONSE:
200 OK
{
    timeStarted: Date,
    nextGameAt: Date,
    state: "STARTED|ENDED",
    currentBets: [],
    lastCrashes: [Number]
}
```

### Place a trade

```
REQUEST:
POST /api/trade
{
    "amount": 13,
    "crashFactor": 1.1276
}

RESPONSE:
200 OK
```

## Notifications

### Game starts

```json
{
    to: GAME_NAME,
    event: "CASINO_START",
    data: {
        gameId: "Id of the next round",
        gameName: "Name of the game that is starting"
    }
}
```

### Game ends

```json
{
    to: GAME_NAME,
    event: "CASINO_END",
    data: {
        crashFactor: "Final crash factor decided",
        gameId: "Id of the round that has just ended",
        gameName: "Name of the game that is ending"
    }
}
```

### User places bet

```json
{
    to: GAME_NAME,
    event: "CASINO_TRADE",
    data: {
        amount: "Amount of tokens staked by user",
        crashFactor: "Crash factor guess by user",
        username: "Username of the user"
    }
}
```

### User receives reward

```json
{
    to: winner.userid,
    event: "CASINO_REWARD",
    data: {
        crashFactor: "Crash factor decided by player",
        gameId: "Id of the game where bet was placed",
        gameName: "Name of the game",
        stakedAmount: "Original amount staked by user",
        reward: "Final reward won by user"
    }
}
```

### Provably fair
Related env variables names:
- HASH_SEED - PUBLIC SEED, hash from BTC block
- CRASHGAME_SEED_SECRET - based on this we will generate hashes chain for crash game (2_000_000) when crash game start and store it in memory
#### Elon game public seed:
```js
//Hash from BTC block #XXXXX.
// https://www.blockchain.com/btc/block/713947
// AS
// public seed
const PUBLIC_SEED = '0000000000000000000b67781ed2770ccf35c15006de5df06efa99a65323b82f';
```

#### Pump Dump game public seed:
```js
//Hash from BTC block #XXXXX.
// https://www.blockchain.com/btc/block/713946
// AS
// public seed
const PUBLIC_SEED = '0000000000000000000b4984b5442f1059816a4065fa0f21cbf61d816dc2fa64';
```

## Additional Info

Author: [Guilherme Mussi, Lead Engineer](https://github.com/gmussi/)

License: AGPL 3.0
