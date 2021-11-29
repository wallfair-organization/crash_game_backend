module.exports = {
    totalDelayTime: (crashFactor) => {
        var totalDelayTime = 0;
        let delay = 0;

        for (i = 1; i <= crashFactor; i = i + 0.01) {
            if (i > 1  && i < 3.00) {
                delay = 190; //speed: 38000/200 => 190 per 0.01 increment
            } 
            if (i >= 3.00  && i < 5.00) {
                delay = 110;     //speed: 22000/200 => 110 per 0.01 increment
            } 
            if (i >= 5.00  && i < 8.00) {
                delay = 65;     //speed: 20000/300 => 66.66 per 0.01 increment
            } 
            if (i >= 8.00  && i < 10) {
                delay = 80;     
            }  
            if (i >= 10 && i < 15) {
                delay = 80;
            }
            if (i >= 15 && i < 50) {
                delay = 60;
            } 
            if (i >= 50) {
                delay = 52;
            }

            totalDelayTime = totalDelayTime + delay;
        }       
        return totalDelayTime;  //in seconds
    },

    calculateCrashFactor: (timeDiff) => {
        var offsetTime = 0;
        var offsetFactor = 0;
        let speed = 0;

        if (timeDiff > 0  && timeDiff < 38000) {
            offsetTime = 0;
            offsetFactor = 1.0; 
            speed = 190;
        } 
        if (timeDiff >= 38000  && timeDiff < 60000) {
            offsetTime = 38000;
            offsetFactor = 3.0;
            speed = 110;
        } 
        if (timeDiff >= 60000  && timeDiff < 79500) {
            offsetTime = 60000;
            offsetFactor = 5.0;
            speed = 65;    
        } 
        if (timeDiff >= 79500  && timeDiff < 95500) {
            offsetTime = 79500;
            offsetFactor = 8.0;
            speed = 80;    
        }
        if (timeDiff >= 95500  && timeDiff < 135500) {
            offsetTime = 95500;
            offsetFactor = 10.0;
            speed = 80;     
        }
        if (timeDiff >= 135500  && timeDiff < 345500) {
            offsetTime = 135500;
            offsetFactor = 15.0;
            speed = 60;     
        }
        if (timeDiff >= 345500) {
            offsetTime = 345500;
            offsetFactor = 50.0;
            speed = 52;    
        }

        //console.log(`((${timeDiff}-${offsetTime})/${speed} * 0.01) + ${offsetFactor}`)
        return ( ((timeDiff-offsetTime)/speed * 0.01) + offsetFactor).toFixed(2);  //currentCrashFactor
    }
}

const gaussian = require("@wallfair.io/wallfair-commons").utils
    .getGaussian(0, 0.3);

main = () => {
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