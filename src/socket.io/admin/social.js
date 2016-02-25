"use strict";

var social = require('../../social'),
	SocketSocial = {};

SocketSocial.savePostSharingNetworks = function(socket, data, callback) {
	social.setActivePostSharingNetworks(data, callback);
};

module.exports = SocketSocial;