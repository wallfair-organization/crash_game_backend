/* eslint-disable no-console */
module.exports = {
  /** logs won't be displayed on NODE_ENV production */
  info(message, ...args) {
    if (process.env.NODE_ENV === 'STAGING') {
      console.log('\x1b[90mINFO\x1b[0m', message, args);
    }
  },
  /** Method to log errors */
  error(message, ...args) {
    console.error('\x1b[31mERROR\x1b[0m', message, args);
  },
  /** These logs will always be logged */
  always(message, ...args) {
    console.log('ALAWYS', message, args);
  },
};
