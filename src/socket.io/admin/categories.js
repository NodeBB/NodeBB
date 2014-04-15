"use strict";

var groups = require('../../groups'),
	user = require('../../user'),
	categories = require('../../categories'),
	categoryTools = require('../../categoryTools'),
	index = require('../index'),
	async = require('async'),
	Categories = {};

Categories.create = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.create(data, callback);
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

	user.search(username, function(err, data) {
		async.map(data.users, function(userObj, next) {
			categoryTools.privileges(cid, userObj.uid, function(err, privileges) {
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

	var	cid = data.cid,
		uid = data.uid,
		privilege = data.privilege,
		set = data.set,
		cb = function(err) {
			if(err) {
				return callback(err);
			}
			categoryTools.privileges(cid, uid, callback);
		};

	if (set) {
		groups.join('cid:' + cid + ':privileges:' + privilege, uid, cb);
	} else {
		groups.leave('cid:' + cid + ':privileges:' + privilege, uid, cb);
	}
};

Categories.getPrivilegeSettings = function(socket, cid, callback) {
	async.parallel({
		"+r": function(next) {
			groups.get('cid:' + cid + ':privileges:+r', { expand: true }, function(err, groupObj) {
				if (!err) {
					next.apply(this, arguments);
				} else {
					next(null, {
						members: []
					});
				}
			});
		},
		"+w": function(next) {
			groups.get('cid:' + cid + ':privileges:+w', { expand: true }, function(err, groupObj) {
				if (!err) {
					next.apply(this, arguments);
				} else {
					next(null, {
						members: []
					});
				}
			});
		},
		"mods": function(next) {
			groups.get('cid:' + cid + ':privileges:mods', { expand: true }, function(err, groupObj) {
				if (!err) {
					next.apply(this, arguments);
				} else {
					next(null, {
						members: []
					});
				}
			});
		}
	}, function(err, data) {
		if(err) {
			return callback(err);
		}

		callback(null, {
			"+r": data['+r'].members,
			"+w": data['+w'].members,
			"mods": data.mods.members
		});
	});
};

Categories.setGroupPrivilege = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (data.set) {
		groups.join('cid:' + data.cid + ':privileges:' + data.privilege, data.name, callback);
	} else {
		groups.leave('cid:' + data.cid + ':privileges:' + data.privilege, data.name, callback);
	}
};

Categories.groupsList = function(socket, cid, callback) {
	groups.list({
		expand: false,
		showSystemGroups: true
	}, function(err, data) {
		if(err) {
			return callback(err);
		}

		async.map(data, function(groupObj, next) {
			categoryTools.groupPrivileges(cid, groupObj.name, function(err, privileges) {
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