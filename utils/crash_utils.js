module.exports = {
    totalDelayTime: (crashFactor) => {
        var totalDelayTime = 0;
        let delay = 0;

        for (i = 1; i <= crashFactor; i = i + 0.01) {

            if (i > 1  && i < 2.50) {
                delay = 120; //speed: 18000/150 => 120 per 0.01 increment
            } 
            if (i >= 2.50  && i < 5) {
                delay = 100;     //speed: 25000/250 => 100 per 0.01 increment
            } 
            if (i >= 5.00  && i < 7.50) {
                delay = 60;     //speed: 15000/250 => 60 per 0.01 increment
            } 
            if (i >= 7.50  && i < 10) {
                delay = 40;     //speed: 10000/250 => 40 per 0.01 increment
            }  
            if (i >= 10 && i < 25) {
                delay = 30;
            }
            if (i >= 25 && i < 50) {
                delay = 20;
            } 
            if (i >= 50 && i < 75) {
                delay = 10;
            }
            if (i >= 75) {
                delay = 5;
            }

            totalDelayTime = totalDelayTime + delay;
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
        if (timeDiff >= 18000  && timeDiff < 43000) {
            offsetTime = 18000;
            offsetFactor = 2.5;
            speed = 100;     //speed: 25000/250 => 100 per 0.01 increment
        } 
        if (timeDiff >= 43000  && timeDiff < 58000) {
            offsetTime = 43000;
            offsetFactor = 5;
            speed = 60;     //speed: 15000/250 => 60 per 0.01 increment
        } 
        if (timeDiff >= 58000  && timeDiff <= 68000) {
            offsetTime = 58000;
            offsetFactor = 7.5;
            speed = 40;     //speed: 10000/250 => 40 per 0.01 increment
        }
        if (timeDiff >= 68000  && timeDiff <= 112970) {
            offsetTime = 68000;
            offsetFactor = 10;
            speed = 30;     //speed: 10000/250 => 40 per 0.01 increment
        }
        if (timeDiff >= 112970  && timeDiff <= 162990) {
            offsetTime = 112970;
            offsetFactor = 25;
            speed = 20;     //speed: 10000/250 => 40 per 0.01 increment
        }
        if (timeDiff >= 162990  && timeDiff <= 187980) {
            offsetTime = 162990;
            offsetFactor = 50;
            speed = 10;     //speed: 10000/250 => 40 per 0.01 increment
        }
        if (timeDiff >= 187980  && timeDiff <= 200480) {
            offsetTime = 187980;
            offsetFactor = 75;
            speed = 5;     //speed: 10000/250 => 40 per 0.01 increment
        }

        return ( ((timeDiff-offsetTime)/speed * 0.01) + offsetFactor).toFixed(2);  //currentCrashFactor
    }
}

const gaussian = require("@wallfair.io/wallfair-commons").utils
    .getGaussian(0, 0.3);

main = () => {
    /*for (let i of [2.5, 5, 7.5, 10, 25, 50, 75, 100]) {
        console.log(i, module.exports.totalDelayTime(i),  module.exports.calculateCrashFactor(module.exports.totalDelayTime(i)));
    }*/
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