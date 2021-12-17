const _ = require('lodash')

const GROWTH_FACTOR = 0.00006;

module.exports = {
    totalDelayTime: (crash) => {
        return _.round(Math.log(crash) / GROWTH_FACTOR, 0);
    },

    calculateCrashFactor: (elapsed) => {
        return Math.max(1, Math.E ** (GROWTH_FACTOR * elapsed));  //currentCrashFactor
    }
}

const gaussian = require("@wallfair.io/wallfair-commons").utils
    .getGaussian(0, 0.3);

const main = () => {
    for (let i = 1; i < 101; i++) {
        console.log(i, module.exports.totalDelayTime(i),  module.exports.calculateCrashFactor(module.exports.totalDelayTime(i)));
    }

    /*for (let i of [2.5, 5, 7.5, 10, 25, 50, 75, 100]) {
        console.log(i, module.exports.totalDelayTime(i) / 1000,  module.exports.calculateCrashFactor(module.exports.totalDelayTime(i)));
    }*/

    return;
    let total = 0;
    let ones = 0;

    let distributions = [];
    for (let i = 0; i < 1000; i++) {
        distributions.push(0);
    }

    for (let i = 0; i < 1000000; i++) {
        let crashFactor = -1;

        var bit = Math.random(); // samples true with prob .4
        
        if (bit < 0.6) {
            crashFactor = gaussian() * 10;
        } else if (bit < 0.85) {
            crashFactor = gaussian() * 30;
        } else {
            crashFactor = gaussian() * 100;
        }
        
        if (crashFactor < 1) {
            crashFactor = 1;
        }

        total++;

        distributions[Math.round(crashFactor / 0.1)]++;

        //console.log("-----------")
        //console.log("Crash factor: ", crashFactor);
        //console.log("Delay time: ", module.exports.totalDelayTime(crashFactor));
        //console.log("Calculated crash factor: ", module.exports.calculateCrashFactor(module.exports.totalDelayTime(crashFactor)));
    }

    for (let i = 0; i < 1000; i++) {
        console.log("Total ", total, i/10, distributions[i], " percentage ", distributions[i]/total);
    }

};
//main();