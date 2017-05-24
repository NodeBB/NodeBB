'use strict';

var social = require('../../social');
var SocketSocial = module.exports;

SocketSocial.savePostSharingNetworks = function (socket, data, callback) {
	social.setActivePostSharingNetworks(data, callback);
};
