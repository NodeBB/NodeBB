"use strict";

var rewardsAdmin = require('../../rewards/admin'),
	SocketRewards = {};

SocketRewards.save = function(socket, data, callback) {
	rewardsAdmin.save(data, callback);
};

SocketRewards.delete = function(socket, data, callback) {
	rewardsAdmin.delete(data, callback);
};


module.exports = SocketRewards;