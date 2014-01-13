"use strict";

var	groups = require('../groups'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	user = require('../user'),
	topics = require('../topics'),
	categories = require('../categories'),
	CategoryTools = require('../categoryTools'),
	logger = require('../logger'),
	admin = {
		user: require('../admin/user'),
		categories: require('../admin/categories')
	},

	async = require('async'),
	winston = require('winston'),

	SocketAdmin = {};

SocketAdmin.before = function(sessionData, next) {
	// Verify administrative privileges
	user.isAdministrator(sessionData.uid, function(err, isAdmin) {
		if (isAdmin) {
			next();
		} else {
			winston.warn('[socket.io] Call to admin method blocked (accessed by uid ' + sessionData.uid + ')');
		}
	});
};

/* Topics */

SocketAdmin.topics = {};

SocketAdmin.topics.getMore = function(data, callback) {
	topics.getAllTopics(data.limit, data.after, function(err, topics) {
		callback(JSON.stringify(topics));
	});
};

/* User */

SocketAdmin.user = {};

SocketAdmin.user.makeAdmin = function(theirid, sessionData) {
	if (sessionData.uid && sessionData.uid > 0) {
		admin.user.makeAdmin(sessionData.uid, theirid, sessionData.socket);
	}
};

SocketAdmin.user.removeAdmin = function(theirid, sessionData) {
	if (sessionData.uid && sessionData.uid > 0) {
		admin.user.removeAdmin(sessionData.uid, theirid, sessionData.socket);
	}
};

SocketAdmin.user.createUser = function(user, callback, sessionData) {
	if (sessionData.uid && sessionData.uid > 0) {
		admin.user.createUser(sessionData.uid, user, callback);
	}
};

SocketAdmin.user.banUser = function(theirid, sessionData) {
	if (sessionData.uid && sessionData.uid > 0) {
		admin.user.banUser(sessionData.uid, theirid, sessionData.socket, function(isBanned) {
			if(isBanned) {
				if(sessionData.userSockets[theirid]) {
					for(var i=0; i<sessionData.userSockets[theirid].length; ++i) {
						sessionData.userSockets[theirid][i].emit('event:banned');
					}
				}
				module.parent.exports.logoutUser(theirid);
			}
		});
	}
};

SocketAdmin.user.unbanUser = function(theirid, sessionData) {
	if (sessionData.uid && sessionData.uid > 0) {
		admin.user.unbanUser(sessionData.uid, theirid, sessionData.socket);
	}
};

SocketAdmin.user.search = function(username, callback, sessionData) {
	if (!(sessionData.uid && sessionData.uid > 0)) {
		return callback();
	}

	user.search(username, function(data) {
		function isAdmin(userData, next) {
			user.isAdministrator(userData.uid, function(err, isAdmin) {
				if(err) {
					return next(err);
				}

				userData.administrator = isAdmin?'1':'0';
				next();
			});
		}

		async.each(data, isAdmin, function(err) {
			if(err) {
				return callback({message: err.message});
			}

			callback(null, data);
		});
	});
};

/* Categories */

SocketAdmin.categories = {};

SocketAdmin.categories.create = function(data, callback) {
	categories.create(data, function(err, data) {
		callback(err, data);
	});
};

SocketAdmin.categories.update = function(data, sessionData) {
	admin.categories.update(data, sessionData.socket);
};

SocketAdmin.categories.search = function(username, cid, callback, sessionData) {
	if (sessionData.uid && sessionData.uid > 0) {
		user.search(username, function(data) {
			async.map(data, function(userObj, next) {
				CategoryTools.privileges(cid, userObj.uid, function(err, privileges) {
					if (!err) {
						userObj.privileges = privileges;
					} else {
						winston.error('[socket api:admin.categories.search] Could not retrieve permissions');
					}

					next(null, userObj);
				});
			}, function(err, data) {
				if (!callback) {
					sessionData.socket.emit('api:admin.categories.search', data);
				} else {
					callback(null, data);
				}
			});
		});
	} else {
		if (!callback) {
			sessionData.socket.emit('api:admin.user.search', null);
		} else {
			callback();
		}
	}
};

SocketAdmin.categories.setPrivilege = function(cid, uid, privilege, set, callback) {
	var	cb = function(err) {
		CategoryTools.privileges(cid, uid, callback);
	};

	if (set) {
		groups.joinByGroupName('cid:' + cid + ':privileges:' + privilege, uid, cb);
	} else {
		groups.leaveByGroupName('cid:' + cid + ':privileges:' + privilege, uid, cb);
	}
};

SocketAdmin.categories.getPrivilegeSettings = function(cid, callback) {
	async.parallel({
		"+r": function(next) {
			groups.getByGroupName('cid:' + cid + ':privileges:+r', { expand: true }, function(err, groupObj) {
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
			groups.getByGroupName('cid:' + cid + ':privileges:+w', { expand: true }, function(err, groupObj) {
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
		callback(null, {
			"+r": data['+r'].members,
			"+w": data['+w'].members
		});
	});
};

SocketAdmin.categories.setGroupPrivilege = function(cid, gid, privilege, set, callback) {
	if (set) {
		groups.joinByGroupName('cid:' + cid + ':privileges:' + privilege, gid, callback);
	} else {
		groups.leaveByGroupName('cid:' + cid + ':privileges:' + privilege, gid, callback);
	}
};

SocketAdmin.categories.groupsList = function(cid, callback) {
	groups.list({expand:false}, function(err, data){
		async.map(data, function(groupObj, next) {
			CategoryTools.groupPrivileges(cid, groupObj.gid, function(err, privileges) {
				if (!err) {
					groupObj.privileges = privileges;
				} else {
					winston.error('[socket api:admin.categories.groupsList] Could not retrieve permissions');
				}

				next(null, groupObj);
			});
		}, function(err, data) {
			callback(null, data);
		});
	});
};

/* Themes & Plugins */

SocketAdmin.themes = {};
SocketAdmin.plugins = {};

SocketAdmin.themes.getInstalled = function(callback) {
	meta.themes.get(function(err, themeArr) {
		callback(themeArr);
	});
};

SocketAdmin.themes.set = meta.themes.set;

SocketAdmin.plugins.toggle = function(plugin_id, sessionData) {
	plugins.toggleActive(plugin_id, function(status) {
		sessionData.socket.emit('api:admin.plugins.toggle', status);
	});
};

/* Configs */

SocketAdmin.config = {};

SocketAdmin.config.get = function(callback, sessionData) {
	meta.configs.list(function(err, config) {
		if (!err) {
			callback(config);
		}
	});
};

SocketAdmin.config.set = function(data, callback, sessionData) {
	meta.configs.set(data.key, data.value, function(err) {
		if (!err) {
			callback({
				status: 'ok'
			});

			plugins.fireHook('action:config.set', {
				key: data.key,
				value: data.value
			});
		}

		logger.monitorConfig({io: sessionData.server}, data);
	});
};

SocketAdmin.config.remove = function(key) {
	meta.configs.remove(key);
};

/* Groups */

SocketAdmin.groups = {};

SocketAdmin.groups.create = function(data, callback) {
	groups.create(data.name, data.description, function(err, groupObj) {
		callback(err ? err.message : null, groupObj || undefined);
	});
};

SocketAdmin.groups.delete = function(gid, callback) {
	groups.destroy(gid, function(err) {
		callback(err ? err.message : null, err ? null : 'OK');
	});
};

SocketAdmin.groups.get = function(gid, callback) {
	groups.get(gid, {
		expand: true
	}, function(err, groupObj) {
		callback(err ? err.message : null, groupObj || undefined);
	});
};

SocketAdmin.groups.join = function(data, callback) {
	groups.join(data.gid, data.uid, callback);
};

SocketAdmin.groups.leave = function(data, callback) {
	groups.leave(data.gid, data.uid, callback);
};

SocketAdmin.groups.update = function(data, callback) {
	groups.update(data.gid, data.values, function(err) {
		callback(err ? err.message : null);
	});
};

module.exports = SocketAdmin;