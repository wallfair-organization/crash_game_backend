const {WFAIR_REWARDS} = require('../utils/constants')
const {getCasinoGamePlayCount} = require("./statistics-service");
const { notificationEvents } = require("@wallfair.io/wallfair-commons/constants/eventTypes");
const amqp = require('./amqp-service');
const { ONE, AccountNamespace, Wallet }  = require('@wallfair.io/trading-engine');

exports.mintUser = async (userId, amount) => {
    if(amount) {
        const beneficiary = { owner: userId, namespace: AccountNamespace.USR, symbol: 'WFAIR' };
        await new Wallet().mint(beneficiary, BigInt(amount) * ONE).catch((err)=> {
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
    // publish message for uniEvent
    amqp.send('universal_events', 'event.user_reward', JSON.stringify({
        event: notificationEvents.EVENT_USER_AWARD,
        producer: 'user',
        producerId: userId,
        data: awardData,
        broadcast
    }))
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
        awardData.total = total;

        //publish in universalevents collection and add tokens
        await this.createUserAwardEvent({
            userId,
            awardData
        }).catch((err)=> {
            console.error('createUserAwardEvent', err)
        })
    }
}
