'use strict';

const navigationAdmin = require('../../navigation/admin');

const SocketNavigation = module.exports;

SocketNavigation.save = async function (socket, data) {
	await navigationAdmin.save(data);
};
