'use strict';

const social = require('../../social');

const SocketSocial = module.exports;

SocketSocial.savePostSharingNetworks = async function (socket, data) {
	await social.setActivePostSharingNetworks(data);
};
