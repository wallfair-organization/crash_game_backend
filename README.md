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

## Notifications

Game start:

```json
{
    "action": "GAME_START,
    "gameId": "",
}
```

Game end:
```json
{
    "action": "GAME_END,
    "gameId": "",
    "crashFactor": 1.234
}
```

## Additional Info

Author: [Guilherme Mussi, Lead Engineer](https://github.com/gmussi/)

License: AGPL 3.0