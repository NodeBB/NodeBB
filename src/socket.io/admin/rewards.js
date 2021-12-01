'use strict';

const rewardsAdmin = require('../../rewards/admin');

const SocketRewards = module.exports;

SocketRewards.save = async function (socket, data) {
	return await rewardsAdmin.save(data);
};

SocketRewards.delete = async function (socket, data) {
	await rewardsAdmin.delete(data);
};
