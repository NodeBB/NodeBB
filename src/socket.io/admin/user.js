"use strict";


var groups = require('../../groups'),
	user = require('../../user'),
	events = require('../../events'),
	websockets = require('../index'),
	async = require('async'),
	User = {};


User.makeAdmin = function(socket, theirid, callback) {
	groups.join('administrators', theirid, callback);
};

User.removeAdmin = function(socket, theirid, callback) {
	groups.leave('administrators', theirid, callback);
};

User.createUser = function(socket, userData, callback) {
	if (!userData) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	user.create(userData, callback);
};

User.banUser = function(socket, theirid, callback) {
	user.isAdministrator(theirid, function(err, isAdmin) {
		if (err || isAdmin) {
			return callback(err || new Error('[[error:cant-ban-other-admins]]'));
		}

		user.ban(theirid, function(err) {
			if (err) {
				return callback(err);
			}

			var sockets = websockets.getUserSockets(theirid);

			for(var i=0; i<sockets.length; ++i) {
				sockets[i].emit('event:banned');
			}

			websockets.logoutUser(theirid);
			callback();
		});
	});
};

User.unbanUser = function(socket, theirid, callback) {
	user.unban(theirid, callback);
};

User.deleteUser = function(socket, theirid, callback) {
	user.delete(theirid, function(err) {
		if (err) {
			return callback(err);
		}

		events.logAdminUserDelete(socket.uid, theirid);

		websockets.logoutUser(theirid);
		callback();
	});
};

User.search = function(socket, username, callback) {
	user.search(username, function(err, data) {
		function isAdmin(userData, next) {
			user.isAdministrator(userData.uid, function(err, isAdmin) {
				if(err) {
					return next(err);
				}

				userData.administrator = isAdmin?'1':'0';
				next();
			});
		}

		if (err) {
			return callback(err);
		}

		async.each(data.users, isAdmin, function(err) {
			callback(err, data);
		});
	});
};

module.exports = User;