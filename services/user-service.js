const { Erc20 } = require('@wallfair.io/smart_contract_mock');
const wallfair = require('@wallfair.io/wallfair-commons');

const {WFAIR_REWARDS} = require('../utils/constants')
const {getCasinoGamePlayCount, getTotalPlayedDaysInRow} = require("./statistics-service");
const { publishEvent, notificationEvents } = require('./notification-service')

const WFAIR = new Erc20('WFAIR');

exports.mintUser = async (userId, amount) => {
    if(amount) {
        await WFAIR.mint(userId, BigInt(amount) * WFAIR.ONE).catch((err)=> {
            console.error("mintUser err", err);
        });
    }
};

/***
 * create USER_AWARD event in universalevents, add proper token amount based on `awardData.award` amount
 * @param userId
 * @returns {Promise<void>} undefined
 */

exports.createUserAwardEvent = async ({userId, awardData, broadcast = false}) => {
    //add token amount for award during event creation
    if(awardData?.award) {
        await this.mintUser(userId, awardData.award).catch((err)=> {
            console.error('award mintUser', err)
        })
    }

    publishEvent(notificationEvents.EVENT_USER_AWARD, {
        producer: 'user',
        producerId: userId,
        data: awardData,
        broadcast
    });
}

/***
 * check total played games for user and save USER_AWARD event, after reaching each levels
 * @param userId
 * @param gameData
 * @returns {Promise<void>} undefined
 */
exports.checkTotalGamesPlayedAward = async (userId, gameData) => {
    const awardData = {
        type: `TOTAL_ROSI_GAME_PLAYED_ABOVE_VALUE`,
        ...gameData
    };

    const totalPlayed = await getCasinoGamePlayCount(userId, gameData.gameTypeId).catch((err)=> {
        console.error('getCasinoGamePlayCount', err)
    });

    const total = awardData.total = totalPlayed || 0;
    if([5, 20, 40, 60, 100].includes(total)) {
        awardData.award = WFAIR_REWARDS.totalGamesPlayed[total];

        //publish in universalevents collection and add tokens
        await this.createUserAwardEvent({
            userId,
            awardData
        }).catch((err)=> {
            console.error('createUserAwardEvent', err)
        })
    }

    //handle easter egg play rosi game 200 times
    if(total === 200) {
        awardData.type = "PLAY_ROSI_GAME_200_TIMES";
        awardData.group = 'easter_egg';
        awardData.award = WFAIR_REWARDS.easterEggs.played200TimesRosiGame;

        //publish in universalevents collection and add tokens
        await this.createUserAwardEvent({
            userId,
            awardData
        }).catch((err)=> {
            console.error('createUserAwardEvent', err)
        })
    }
}

/***
 * check user played X days in a row USER AWARD
 * @param userId
 * @param gameData
 * @returns {Promise<void>} undefined
 */
exports.checkUserPlayedLastXDaysInRow = async (userId, gameData) => {
    const totalDays = 6;
    const awardData = {
        type: `GAMES_USER_PLAYED_X_DAYS_IN_ROW`,
        ...gameData
    };

    const totalDaysPlayed = await getTotalPlayedDaysInRow(userId, totalDays).catch((err)=> {
        console.error('getCasinoGamePlayCount', err)
    });

    if(totalDaysPlayed.length === totalDays) {
        //handle SET_USERNAME award
        const checkAwardExist = await this.checkAwardExist(userId, awardData.type).catch((err)=> {
            console.error('checkAwardExist err', err);
        })

        if(checkAwardExist.length === 0) {
            awardData.award = WFAIR_REWARDS.easterEggs.playedXDaysInRow;
            awardData.totalDaysInRow = totalDays;
            //publish in universalevents collection and add tokens
            await this.createUserAwardEvent({
                userId,
                awardData
            }).catch((err)=> {
                console.error('createUserAwardEvent', err)
            })
        }
    }
}

/***
 * check award exist for username and defined type
 * @param userId
 * @returns {Promise<void>} undefined
 */
exports.checkAwardExist = async (userId, type) => {
    return wallfair.models.UniversalEvent.find({
        userId,
        'data.type': type
    });
}
