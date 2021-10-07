module.exports = {
    totalDelayTime: (crashFactor) => {
        var totalDelayTime = 0;
        let speed = 0;

        for (i = 1; i <= crashFactor; i = i + 0.01) {

            if (i > 1  && i < 2.50) {
                speed = 120; //speed: 18000/150 => 120 per 0.01 increment
            } 
            if (i >= 2.50  && i < 5.00) {
                speed = 100;     //speed: 25000/250 => 100 per 0.01 increment
            } 
            if (i >= 5.00  && i < 7.50) {
                speed = 60;     //speed: 15000/250 => 60 per 0.01 increment
            } 
            if (i >= 7.50  && i <= 10.00) {
                speed = 40;     //speed: 10000/250 => 40 per 0.01 increment
            }  

            totalDelayTime = totalDelayTime + speed;
        }       
        return totalDelayTime;  //in seconds
    },

    calculateCrashFactor: (timeDiff) => {
        var offsetTime = 0;
        var offsetFactor = 0;
        let speed = 0;

        if (timeDiff > 0  && timeDiff < 18000) {
            offsetTime = 0;
            offsetFactor = 1; 
            speed = 120;
            //speed: 18000/150 => 120 per 0.01 increment
        } 
        if (timeDiff >= 18000  && timeDiff < (18000+25000)) {
            offsetTime = 18000;
            offsetFactor = 2.5;
            speed = 100;     //speed: 25000/250 => 100 per 0.01 increment
        } 
        if (timeDiff >= (18000+25000)  && timeDiff < (18000+25000+15000)) {
            offsetTime = (18000+25000);
            offsetFactor = 5;
            speed = 60;     //speed: 15000/250 => 60 per 0.01 increment
        } 
        if (timeDiff >= (18000+25000+15000)  && timeDiff <= (18000+25000+15000+10000)) {
            offsetTime = (18000+25000+15000);
            offsetFactor = 7.5;
            speed = 40;     //speed: 10000/250 => 40 per 0.01 increment
        }

        return ( ((timeDiff-offsetTime)/speed * 0.01) + offsetFactor).toFixed(2);  //currentCrashFactor
    }
}

const gaussian = require("@wallfair.io/wallfair-commons").utils
    .getGaussian(0, 0.3);

main = () => {
    for (let i = 0; i < 10; i++) {
        let crashFactor = gaussian() * 10;
        if (crashFactor < 1) {
            continue;
        }
        console.log("-----------")
        console.log("Crash factor: ", crashFactor);
        console.log("Delay time: ", module.exports.totalDelayTime(crashFactor));
        console.log("Calculated crash factor: ", module.exports.calculateCrashFactor(module.exports.totalDelayTime(crashFactor)));
    }

};
//main();