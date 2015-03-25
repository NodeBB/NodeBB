"use strict";

var async = require('async'),

	groups = require('../../groups'),
	user = require('../../user'),
	categories = require('../../categories'),
	privileges = require('../../privileges'),
	Categories = {};

Categories.create = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.create(data, callback);
};

Categories.purge = function(socket, cid, callback) {
	categories.purge(cid, callback);
};

Categories.update = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.update(data, callback);
};

Categories.search = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var	username = data.username,
		cid = data.cid;

	user.search({query: username, uid: socket.uid}, function(err, data) {
		if (err) {
			return callback(err);
		}

		async.map(data.users, function(userObj, next) {
			privileges.categories.userPrivileges(cid, userObj.uid, function(err, privileges) {
				if(err) {
					return next(err);
				}

				userObj.privileges = privileges;
				next(null, userObj);
			});
		}, callback);
	});
};

Categories.setPrivilege = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups[data.set ? 'join' : 'leave']('cid:' + data.cid + ':privileges:' + data.privilege, data.uid, callback);
};

Categories.getPrivilegeSettings = function(socket, cid, callback) {
	var privileges = ['find', 'read', 'topics:create', 'topics:reply', 'mods'];

	async.reduce(privileges, [], function(members, privilege, next) {
		groups.get('cid:' + cid + ':privileges:' + privilege, { expand: true }, function(err, groupObj) {
			if (err || !groupObj) {
				return next(null, members);
			}

			members = members.concat(groupObj.members);

			next(null, members);
		});
	}, function(err, members) {
		if (err) {
			return callback(err);
		}
		// Remove duplicates
		var	present = [],
			x = members.length,
			uid;
		while(x--) {
			uid = parseInt(members[x].uid, 10);
			if (present.indexOf(uid) !== -1) {
				members.splice(x, 1);
			} else {
				present.push(uid);
			}
		}

		callback(err, members);
	});
};

Categories.setGroupPrivilege = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups[data.set ? 'join' : 'leave']('cid:' + data.cid + ':privileges:' + data.privilege, data.name, function (err) {
		if (err) {
			return callback(err);
		}

		groups.hide('cid:' + data.cid + ':privileges:' + data.privilege, callback);
	});
};

Categories.groupsList = function(socket, cid, callback) {
	groups.list({
		expand: false,
		isAdmin: true,
		showSystemGroups: true
	}, function(err, data) {
		if(err) {
			return callback(err);
		}

		// Remove privilege groups
		data = data.filter(function(groupObj) {
			return groupObj.name.indexOf(':privileges:') === -1;
		});

		async.map(data, function(groupObj, next) {
			privileges.categories.groupPrivileges(cid, groupObj.name, function(err, privileges) {
				if(err) {
					return next(err);
				}

				groupObj.privileges = privileges;
				next(null, groupObj);
			});
		}, callback);
	});
};

module.exports = Categories;