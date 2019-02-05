'use strict';

var async = require('async');

var groups = require('../groups');
var meta = require('../meta');
var user = require('../user');
var utils = require('../utils');
var groupsController = require('../controllers/groups');
var events = require('../events');
var privileges = require('../privileges');

var SocketGroups = module.exports;

SocketGroups.before = function (socket, method, data, next) {
	if (!data) {
		return next(new Error('[[error:invalid-data]]'));
	}
	next();
};

SocketGroups.join = function (socket, data, callback) {
	if (socket.uid <= 0) {
		return callback(new Error('[[error:invalid-uid]]'));
	}

	if (data.groupName === 'administrators' || groups.isPrivilegeGroup(data.groupName)) {
		return callback(new Error('[[error:not-allowed]]'));
	}

	async.waterfall([
		function (next) {
			groups.exists(data.groupName, next);
		},
		function (exists, next) {
			if (!exists) {
				return next(new Error('[[error:no-group]]'));
			}

			if (!meta.config.allowPrivateGroups) {
				return groups.join(data.groupName, socket.uid, callback);
			}

			async.parallel({
				isAdmin: async.apply(user.isAdministrator, socket.uid),
				groupData: async.apply(groups.getGroupData, data.groupName),
			}, next);
		},
		function (results, next) {
			if (results.groupData.private && results.groupData.disableJoinRequests) {
				return next(new Error('[[error:join-requests-disabled]]'));
			}

			if (!results.groupData.private || results.isAdmin) {
				groups.join(data.groupName, socket.uid, next);
			} else {
				groups.requestMembership(data.groupName, socket.uid, next);
			}
		},
	], callback);
};

SocketGroups.leave = function (socket, data, callback) {
	if (socket.uid <= 0) {
		return callback(new Error('[[error:invalid-uid]]'));
	}

	if (data.groupName === 'administrators') {
		return callback(new Error('[[error:cant-remove-self-as-admin]]'));
	}

	groups.leave(data.groupName, socket.uid, callback);
};

SocketGroups.addMember = isOwner(function (socket, data, callback) {
	if (data.groupName === 'administrators' || groups.isPrivilegeGroup(data.groupName)) {
		return callback(new Error('[[error:not-allowed]]'));
	}
	groups.join(data.groupName, data.uid, callback);
});

function isOwner(next) {
	return function (socket, data, callback) {
		async.parallel({
			isAdmin: async.apply(user.isAdministrator, socket.uid),
			isGlobalModerator: async.apply(user.isGlobalModerator, socket.uid),
			isOwner: async.apply(groups.ownership.isOwner, socket.uid, data.groupName),
			group: async.apply(groups.getGroupData, data.groupName),
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			var isOwner = results.isOwner || results.isAdmin || (results.isGlobalModerator && !results.group.system);
			if (!isOwner) {
				return callback(new Error('[[error:no-privileges]]'));
			}
			next(socket, data, callback);
		});
	};
}

function isInvited(next) {
	return function (socket, data, callback) {
		groups.isInvited(socket.uid, data.groupName, function (err, invited) {
			if (err || !invited) {
				return callback(err || new Error('[[error:not-invited]]'));
			}
			next(socket, data, callback);
		});
	};
}

SocketGroups.grant = isOwner(function (socket, data, callback) {
	groups.ownership.grant(data.toUid, data.groupName, callback);
});

SocketGroups.rescind = isOwner(function (socket, data, callback) {
	groups.ownership.rescind(data.toUid, data.groupName, callback);
});

SocketGroups.accept = isOwner(function (socket, data, callback) {
	async.waterfall([
		function (next) {
			groups.acceptMembership(data.groupName, data.toUid, next);
		},
		function (next) {
			events.log({
				type: 'accept-membership',
				uid: socket.uid,
				ip: socket.ip,
				groupName: data.groupName,
				targetUid: data.toUid,
			});
			setImmediate(next);
		},
	], callback);
});

SocketGroups.reject = isOwner(function (socket, data, callback) {
	async.waterfall([
		function (next) {
			groups.rejectMembership(data.groupName, data.toUid, next);
		},
		function (next) {
			events.log({
				type: 'reject-membership',
				uid: socket.uid,
				ip: socket.ip,
				groupName: data.groupName,
				targetUid: data.toUid,
			});
			setImmediate(next);
		},
	], callback);
});

SocketGroups.acceptAll = isOwner(function (socket, data, callback) {
	acceptRejectAll(SocketGroups.accept, socket, data, callback);
});

SocketGroups.rejectAll = isOwner(function (socket, data, callback) {
	acceptRejectAll(SocketGroups.reject, socket, data, callback);
});

function acceptRejectAll(method, socket, data, callback) {
	async.waterfall([
		function (next) {
			groups.getPending(data.groupName, next);
		},
		function (uids, next) {
			async.each(uids, function (uid, next) {
				method(socket, { groupName: data.groupName, toUid: uid }, next);
			}, next);
		},
	], callback);
}

SocketGroups.issueInvite = isOwner(function (socket, data, callback) {
	groups.invite(data.groupName, data.toUid, callback);
});

SocketGroups.issueMassInvite = isOwner(function (socket, data, callback) {
	if (!data || !data.usernames || !data.groupName) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var usernames = String(data.usernames).split(',');
	usernames = usernames.map(function (username) {
		return username && username.trim();
	});

	async.waterfall([
		function (next) {
			user.getUidsByUsernames(usernames, next);
		},
		function (uids, next) {
			uids = uids.filter(function (uid) {
				return !!uid && parseInt(uid, 10);
			});

			async.eachSeries(uids, function (uid, next) {
				groups.invite(data.groupName, uid, next);
			}, next);
		},
	], callback);
});

SocketGroups.rescindInvite = isOwner(function (socket, data, callback) {
	groups.rejectMembership(data.groupName, data.toUid, callback);
});

SocketGroups.acceptInvite = isInvited(function (socket, data, callback) {
	groups.acceptMembership(data.groupName, socket.uid, callback);
});

SocketGroups.rejectInvite = isInvited(function (socket, data, callback) {
	groups.rejectMembership(data.groupName, socket.uid, callback);
});

SocketGroups.update = isOwner(function (socket, data, callback) {
	groups.update(data.groupName, data.values, callback);
});


SocketGroups.kick = isOwner(function (socket, data, callback) {
	if (socket.uid === parseInt(data.uid, 10)) {
		return callback(new Error('[[error:cant-kick-self]]'));
	}

	async.waterfall([
		function (next) {
			groups.ownership.isOwner(data.uid, data.groupName, next);
		},
		function (isOwner, next) {
			groups.kick(data.uid, data.groupName, isOwner, next);
		},
	], callback);
});

SocketGroups.create = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	} else if (groups.isPrivilegeGroup(data.name)) {
		return callback(new Error('[[error:invalid-group-name]]'));
	}

	async.waterfall([
		function (next) {
			privileges.global.can('group:create', socket.uid, next);
		},
		function (canCreate, next) {
			if (!canCreate) {
				return next(new Error('[[error:no-privileges]]'));
			}
			data.ownerUid = socket.uid;
			groups.create(data, next);
		},
	], callback);
};

SocketGroups.delete = isOwner(function (socket, data, callback) {
	if (data.groupName === 'administrators' ||
		data.groupName === 'registered-users' ||
		data.groupName === 'guests' ||
		data.groupName === 'Global Moderators') {
		return callback(new Error('[[error:not-allowed]]'));
	}

	groups.destroy(data.groupName, callback);
});

SocketGroups.search = function (socket, data, callback) {
	data.options = data.options || {};

	if (!data.query) {
		var groupsPerPage = 15;
		groupsController.getGroupsFromSet(socket.uid, data.options.sort, 0, groupsPerPage - 1, function (err, data) {
			callback(err, !err ? data.groups : null);
		});
		return;
	}

	groups.search(data.query, data.options, callback);
};

SocketGroups.loadMore = function (socket, data, callback) {
	if (!data.sort || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var groupsPerPage = 9;
	var start = parseInt(data.after, 10);
	var stop = start + groupsPerPage - 1;
	groupsController.getGroupsFromSet(socket.uid, data.sort, start, stop, callback);
};

SocketGroups.searchMembers = function (socket, data, callback) {
	data.uid = socket.uid;
	groups.searchMembers(data, callback);
};

SocketGroups.loadMoreMembers = function (socket, data, callback) {
	if (!data.groupName || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	data.after = parseInt(data.after, 10);
	async.waterfall([
		function (next) {
			user.getUsersFromSet('group:' + data.groupName + ':members', socket.uid, data.after, data.after + 9, next);
		},
		function (users, next) {
			next(null, {
				users: users,
				nextStart: data.after + 10,
			});
		},
	], callback);
};

SocketGroups.cover = {};

SocketGroups.cover.update = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	async.waterfall([
		function (next) {
			canModifyGroup(socket.uid, data.groupName, next);
		},
		function (next) {
			groups.updateCover(socket.uid, data, next);
		},
	], callback);
};

SocketGroups.cover.remove = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	async.waterfall([
		function (next) {
			canModifyGroup(socket.uid, data.groupName, next);
		},
		function (next) {
			groups.removeCover(data, next);
		},
	], callback);
};

function canModifyGroup(uid, groupName, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				isOwner: async.apply(groups.ownership.isOwner, uid, groupName),
				isAdminOrGlobalMod: async.apply(user.isAdminOrGlobalMod, uid),
			}, next);
		},
		function (results, next) {
			if (!results.isOwner && !results.isAdminOrGlobalMod) {
				return next(new Error('[[error:no-privileges]]'));
			}
			next();
		},
	], callback);
}
