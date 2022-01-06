exports.findUser = async (users, filter) => {
  return users.find(u => {
    const userId = u._id || u.userid;
    return userId.toString() === filter
  })
};
