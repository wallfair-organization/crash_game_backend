const updateCasinoMatches = async () => {
  console.log('INIT UPDATE');
};

const initGeneralJobs = () => {
    //run on init
    updateCasinoMatches().catch((err)=> {
      errorHandler(err);
    });

    //then every 30 minutes
    setInterval(()=> {
      updateCasinoMatches.catch((err)=> {
        errorHandler(err);
      })
    }, 60*30*1000);
};

const errorHandler = (err) => {
  console.error('initGeneralJobs err', err);
}

exports.initGeneralJobs = initGeneralJobs;
