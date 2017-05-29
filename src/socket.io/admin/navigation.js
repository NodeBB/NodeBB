'use strict';

var navigationAdmin = require('../../navigation/admin');
var SocketNavigation = module.exports;

SocketNavigation.save = function (socket, data, callback) {
	navigationAdmin.save(data, callback);
};
