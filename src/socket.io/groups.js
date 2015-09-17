"use strict";

var	async = require('async'),

	groups = require('../groups'),
	meta = require('../meta'),
	user = require('../user'),
	groupsController = require('../controllers/groups'),

	SocketGroups = {};


SocketGroups.before = function(socket, method, data, next) {
	if (!data) {
		return next(new Error('[[error:invalid-data]]'));
	}
	next();
};

SocketGroups.join = function(socket, data, callback) {
	if (!parseInt(socket.uid, 10)) {
		return callback(new Error('[[error:invalid-uid]]'));
	}

	if (meta.config.allowPrivateGroups !== '0') {
		async.parallel({
			isAdmin: async.apply(user.isAdministrator, socket.uid),
			isPrivate: async.apply(groups.isPrivate, data.groupName)
		}, function(err, checks) {
			if (checks.isPrivate && !checks.isAdmin) {
				groups.requestMembership(data.groupName, socket.uid, callback);
			} else {
				groups.join(data.groupName, socket.uid, callback);
			}
		});
	} else {
		groups.join(data.groupName, socket.uid, callback);
	}
};

SocketGroups.leave = function(socket, data, callback) {
	if (!parseInt(socket.uid, 10)) {
		return callback(new Error('[[error:invalid-uid]]'));
	}

	if (data.groupName === 'administrators') {
		return callback(new Error('[[error:cant-remove-self-as-admin]]'));
	}

	groups.leave(data.groupName, socket.uid, callback);
};

SocketGroups.grant = function(socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (!isOwner) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.ownership.grant(data.toUid, data.groupName, callback);
	});
};

SocketGroups.rescind = function(socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (!isOwner) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.ownership.rescind(data.toUid, data.groupName, callback);
	});
};

SocketGroups.accept = function(socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (!isOwner) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.acceptMembership(data.groupName, data.toUid, callback);
	});
};

SocketGroups.reject = function(socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (!isOwner) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.rejectMembership(data.groupName, data.toUid, callback);
	});
};

SocketGroups.acceptAll = function(socket, data, callback) {
	acceptRejectAll('accept', socket, data, callback);
};

SocketGroups.rejectAll = function(socket, data, callback) {
	acceptRejectAll('reject', socket, data, callback);
};

function acceptRejectAll(type, socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (err || !isOwner) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}
		async.waterfall([
			function(next) {
				groups.getPending(data.groupName, next);
			},
			function(uids, next) {
				var method = type === 'accept' ? groups.acceptMembership : groups.rejectMembership;
				async.each(uids, function(uid, next) {
					method(data.groupName, uid, next);
				}, next);
			}
		], callback);
	});
}

SocketGroups.issueInvite = function(socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (err || !isOwner) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		groups.invite(data.groupName, data.toUid, callback);
	});
};

SocketGroups.rescindInvite = function(socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (err || !isOwner) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		groups.rejectMembership(data.groupName, data.toUid, callback);
	});
};

SocketGroups.acceptInvite = function(socket, data, callback) {
	groups.isInvited(socket.uid, data.groupName, function(err, invited) {
		if (err || !invited) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		groups.acceptMembership(data.groupName, socket.uid, callback);
	});
};

SocketGroups.rejectInvite = function(socket, data, callback) {
	groups.isInvited(socket.uid, data.groupName, function(err, invited) {
		if (err || !invited) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		groups.rejectMembership(data.groupName, socket.uid, callback);
	});
};

SocketGroups.update = function(socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (err || !isOwner) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		groups.update(data.groupName, data.values, callback);
	});
};

SocketGroups.create = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	} else if (parseInt(meta.config.allowGroupCreation, 10) !== 1) {
		return callback(new Error('[[error:group-creation-disabled]]'));
	}


	data.ownerUid = socket.uid;
	groups.create(data, callback);
};

SocketGroups.delete = function(socket, data, callback) {
	if (data.groupName === 'administrators' || data.groupName === 'registered-users') {
		return callback(new Error('[[error:not-allowed]]'));
	}

	var tasks = {
		isOwner: async.apply(groups.ownership.isOwner, socket.uid, data.groupName),
		isAdmin: async.apply(user.isAdministrator, socket.uid)
	};

	async.parallel(tasks, function(err, checks) {
		if (err) {
			return callback(err);
		}
		if (!checks.isOwner && !checks.isAdmin) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.destroy(data.groupName, callback);
	});
};

SocketGroups.search = function(socket, data, callback) {
	data.options = data.options || {};

	if (!data.query) {
		var groupsPerPage = 15;
		groupsController.getGroupsFromSet(socket.uid, data.options.sort, 0, groupsPerPage - 1, function(err, data) {
			callback(err, !err ? data.groups : null);
		});
		return;
	}

	groups.search(data.query, data.options || {}, callback);
};

SocketGroups.loadMore = function(socket, data, callback) {
	if (!data.sort || !data.after) {
		return callback();
	}

	var groupsPerPage = 9;
	var start = parseInt(data.after);
	var stop = start + groupsPerPage - 1;
	groupsController.getGroupsFromSet(socket.uid, data.sort, start, stop, callback);
};

SocketGroups.searchMembers = function(socket, data, callback) {
	data.uid = socket.uid;
	groups.searchMembers(data, callback);
};

SocketGroups.loadMoreMembers = function(socket, data, callback) {
	if (!data.groupName || !parseInt(data.after, 10)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	data.after = parseInt(data.after, 10);
	user.getUsersFromSet('group:' + data.groupName + ':members', socket.uid, data.after, data.after + 9, function(err, users) {
		if (err) {
			return callback(err);
		}

		callback(null, {users: users, nextStart: data.after + 10});
	});
};

SocketGroups.kick = function(socket, data, callback) {
	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (!isOwner) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.leave(data.groupName, data.uid, callback);
	});
};

SocketGroups.cover = {};

SocketGroups.cover.get = function(socket, data, callback) {
	groups.getGroupFields(data.groupName, ['cover:url', 'cover:position'], callback);
};

SocketGroups.cover.update = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (!isOwner) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.updateCover(data, callback);
	});
};

module.exports = SocketGroups;
