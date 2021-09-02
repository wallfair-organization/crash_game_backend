const rdsGet = (client, key) => new Promise((resolve, reject) => {
  client.hgetall(key, (error, data) => {
    if(error) return reject(error);
    return resolve(data);
  })
})

module.exports = {
  rdsGet,
}