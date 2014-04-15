"use strict";

var	groups = require('../groups'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	widgets = require('../widgets'),
	user = require('../user'),
	topics = require('../topics'),
	categories = require('../categories'),
	CategoryTools = require('../categoryTools'),
	logger = require('../logger'),
	events = require('../events'),
	db = require('../database'),
	async = require('async'),
	winston = require('winston'),
	index = require('./index'),

	SocketAdmin = {
		topics: {},
		user: require('admin/user'),
		categories: {},
		themes: {},
		plugins: {},
		widgets: {},
		config: {},
		groups: {},
		settings: {}
	};

SocketAdmin.before = function(socket, next) {
	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (!err && isAdmin) {
			next();
		} else {
			winston.warn('[socket.io] Call to admin method blocked (accessed by uid ' + socket.uid + ')');
		}
	});
};

SocketAdmin.restart = function(socket, data, callback) {
	meta.restart();
};

SocketAdmin.getVisitorCount = function(socket, data, callback) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000
	};
	var now = Date.now();
	async.parallel({
		day: function(next) {
			db.sortedSetCount('ip:recent', now - terms.day, now, next);
		},
		week: function(next) {
			db.sortedSetCount('ip:recent', now - terms.week, now, next);
		},
		month: function(next) {
			db.sortedSetCount('ip:recent', now - terms.month, now, next);
		},
		alltime: function(next) {
			db.sortedSetCount('ip:recent', 0, now, next);
		}
	}, callback);
};

SocketAdmin.fireEvent = function(socket, data, callback) {
	index.server.sockets.emit(data.name, data.payload || {});
};


/* Categories */
SocketAdmin.categories.create = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.create(data, callback);
};

SocketAdmin.categories.update = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.update(data, callback);
};

SocketAdmin.categories.search = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var	username = data.username,
		cid = data.cid;

	user.search(username, function(err, data) {
		async.map(data.users, function(userObj, next) {
			CategoryTools.privileges(cid, userObj.uid, function(err, privileges) {
				if(err) {
					return next(err);
				}

				userObj.privileges = privileges;
				next(null, userObj);
			});
		}, callback);
	});
};

SocketAdmin.categories.setPrivilege = function(socket, data, callback) {
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
			CategoryTools.privileges(cid, uid, callback);
		};

	if (set) {
		groups.join('cid:' + cid + ':privileges:' + privilege, uid, cb);
	} else {
		groups.leave('cid:' + cid + ':privileges:' + privilege, uid, cb);
	}
};

SocketAdmin.categories.getPrivilegeSettings = function(socket, cid, callback) {
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

SocketAdmin.categories.setGroupPrivilege = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (data.set) {
		groups.join('cid:' + data.cid + ':privileges:' + data.privilege, data.name, callback);
	} else {
		groups.leave('cid:' + data.cid + ':privileges:' + data.privilege, data.name, callback);
	}
};

SocketAdmin.categories.groupsList = function(socket, cid, callback) {
	groups.list({
		expand: false,
		showSystemGroups: true
	}, function(err, data) {
		if(err) {
			return callback(err);
		}

		async.map(data, function(groupObj, next) {
			CategoryTools.groupPrivileges(cid, groupObj.name, function(err, privileges) {
				if(err) {
					return next(err);
				}

				groupObj.privileges = privileges;
				next(null, groupObj);
			});
		}, callback);
	});
};

/* Themes, Widgets, and Plugins */
SocketAdmin.themes.getInstalled = function(socket, data, callback) {
	meta.themes.get(callback);
};

SocketAdmin.themes.set = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	widgets.reset(function(err) {
		meta.themes.set(data, function() {
			callback();
			meta.restart();
		});
	});
};

SocketAdmin.plugins.toggle = function(socket, plugin_id) {
	plugins.toggleActive(plugin_id, function(status) {
		socket.emit('admin.plugins.toggle', status);
		meta.restart();
	});
};

SocketAdmin.widgets.set = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	widgets.setArea(data, callback);
};

/* Configs */
SocketAdmin.config.get = function(socket, data, callback) {
	meta.configs.list(callback);
};

SocketAdmin.config.set = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	meta.configs.set(data.key, data.value, function(err) {
		if(err) {
			return callback(err);
		}

		callback(null);

		plugins.fireHook('action:config.set', {
			key: data.key,
			value: data.value
		});

		logger.monitorConfig({io: index.server}, data);
	});
};

SocketAdmin.config.remove = function(socket, key) {
	meta.configs.remove(key);
};

/* Groups */
SocketAdmin.groups.create = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.create(data.name, data.description, function(err, groupObj) {
		callback(err, groupObj || undefined);
	});
};

SocketAdmin.groups.delete = function(socket, groupName, callback) {
	groups.destroy(groupName, callback);
};

SocketAdmin.groups.get = function(socket, groupName, callback) {
	groups.get(groupName, {
		expand: true
	}, function(err, groupObj) {
		callback(err, groupObj || undefined);
	});
};

SocketAdmin.groups.join = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.join(data.groupName, data.uid, callback);
};

SocketAdmin.groups.leave = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.leave(data.groupName, data.uid, callback);
};

SocketAdmin.groups.update = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.update(data.groupName, data.values, function(err) {
		callback(err ? err.message : null);
	});
};

/* Settings */
SocketAdmin.settings.get = function(socket, data, callback) {
	meta.settings.get(data.hash, callback);
};

SocketAdmin.settings.set = function(socket, data, callback) {
	meta.settings.set(data.hash, data.values, callback);
};

module.exports = SocketAdmin;
