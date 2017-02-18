'use strict';

var navigationAdmin = require('../../navigation/admin');
var SocketNavigation = {};

SocketNavigation.save = function (socket, data, callback) {
	navigationAdmin.save(data, callback);
};

module.exports = SocketNavigation;