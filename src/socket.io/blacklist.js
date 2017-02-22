
'use strict';

var user = require('../user');
var meta = require('../meta');

var SocketBlacklist = {};

SocketBlacklist.validate = function (socket, data, callback) {
	meta.blacklist.validate(data.rules, callback);
};

SocketBlacklist.save = function (socket, rules, callback) {
	user.isAdminOrGlobalMod(socket.uid, function (err, isAdminOrGlobalMod) {
		if (err || !isAdminOrGlobalMod) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		meta.blacklist.save(rules, callback);
	});
};


module.exports = SocketBlacklist;
