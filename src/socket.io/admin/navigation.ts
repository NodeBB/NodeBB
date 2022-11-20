'use strict';

const navigationAdmin = require('../../navigation/admin');

const SocketNavigation  = {} as any;

SocketNavigation.save = async function (socket, data) {
	await navigationAdmin.save(data);
};
