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
3. Run `wallfair-commons/scripts/provably-fair/generateHashes` with GENESIS_SEED environment variable specified.
   GENESIS_SEED can be any string.
4. Copy `hashes.txt` to `crash_game_backend/secured` 
5. Use the same string for HASH_SEED environment variable as for GENESIS_SEED in step 3

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

## Additional Info

Author: [Guilherme Mussi, Lead Engineer](https://github.com/gmussi/)

License: AGPL 3.0
