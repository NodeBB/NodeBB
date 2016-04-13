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

	if (data.groupName === 'administrators' || groups.isPrivilegeGroup(data.groupName)) {
		return callback(new Error('[[error:not-allowed]]'));
	}

	groups.exists(data.groupName, function(err, exists) {
		if (err || !exists) {
			return callback(err || new Error('[[error:no-group]]'));
		}

		if (parseInt(meta.config.allowPrivateGroups, 10) !== 1) {
			return groups.join(data.groupName, socket.uid, callback);
		}

		async.parallel({
			isAdmin: async.apply(user.isAdministrator, socket.uid),
			groupData: async.apply(groups.getGroupData, data.groupName)
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (results.groupData.private && results.groupData.disableJoinRequests) {
				return callback(new Error('[[error:join-requests-disabled]]'));
			}

			if (!results.groupData.private || results.isAdmin) {
				groups.join(data.groupName, socket.uid, callback);
			} else {
				groups.requestMembership(data.groupName, socket.uid, callback);
			}
		});
	});
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

function isOwner(next) {
	return function (socket, data, callback) {
		async.parallel({
			isAdmin: async.apply(user.isAdministrator, socket.uid),
			isOwner: async.apply(groups.ownership.isOwner, socket.uid, data.groupName)
		}, function(err, results) {
			if (err || (!isOwner && !results.isAdmin)) {
				return callback(err || new Error('[[error:no-privileges]]'));
			}
			next(socket, data, callback);
		});
	};
}

function isInvited(next) {
	return function (socket, data, callback) {
		groups.isInvited(socket.uid, data.groupName, function(err, invited) {
			if (err || !invited) {
				return callback(err || new Error('[[error:not-invited]]'));
			}
			next(socket, data, callback);
		});
	};
}

SocketGroups.grant = isOwner(function(socket, data, callback) {
	groups.ownership.grant(data.toUid, data.groupName, callback);
});

SocketGroups.rescind = isOwner(function(socket, data, callback) {
	groups.ownership.rescind(data.toUid, data.groupName, callback);
});

SocketGroups.accept = isOwner(function(socket, data, callback) {
	groups.acceptMembership(data.groupName, data.toUid, callback);
});

SocketGroups.reject = isOwner(function(socket, data, callback) {
	groups.rejectMembership(data.groupName, data.toUid, callback);
});

SocketGroups.acceptAll = isOwner(function(socket, data, callback) {
	acceptRejectAll(groups.acceptMembership, socket, data, callback);
});

SocketGroups.rejectAll = isOwner(function(socket, data, callback) {
	acceptRejectAll(groups.rejectMembership, socket, data, callback);
});

function acceptRejectAll(method, socket, data, callback) {
	async.waterfall([
		function(next) {
			groups.getPending(data.groupName, next);
		},
		function(uids, next) {
			async.each(uids, function(uid, next) {
				method(data.groupName, uid, next);
			}, next);
		}
	], callback);
}

SocketGroups.issueInvite = isOwner(function(socket, data, callback) {
	groups.invite(data.groupName, data.toUid, callback);
});

SocketGroups.rescindInvite = isOwner(function(socket, data, callback) {
	groups.rejectMembership(data.groupName, data.toUid, callback);
});

SocketGroups.acceptInvite = isInvited(function(socket, data, callback) {
	groups.acceptMembership(data.groupName, socket.uid, callback);
});

SocketGroups.rejectInvite = isInvited(function(socket, data, callback) {
	groups.rejectMembership(data.groupName, socket.uid, callback);
});

SocketGroups.update = isOwner(function(socket, data, callback) {
	groups.update(data.groupName, data.values, callback);
});


SocketGroups.kick = isOwner(function(socket, data, callback) {
	if (socket.uid === parseInt(data.uid, 10)) {
		return callback(new Error('[[error:cant-kick-self]]'));
	}

	groups.ownership.isOwner(data.uid, data.groupName, function(err, isOwner) {
		if (err) {
			return callback(err);
		}
		groups.kick(data.uid, data.groupName, isOwner, callback);
	});

});

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
	if (data.groupName === 'administrators' ||
		data.groupName === 'registered-users' ||
		data.groupName === 'Global Moderators') {
		return callback(new Error('[[error:not-allowed]]'));
	}

	async.parallel({
		isOwner: async.apply(groups.ownership.isOwner, socket.uid, data.groupName),
		isAdmin: async.apply(user.isAdministrator, socket.uid)
	}, function(err, checks) {
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

SocketGroups.cover = {};

SocketGroups.cover.update = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (err || !isOwner) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		groups.updateCover(socket.uid, data, callback);
	});
};

SocketGroups.cover.remove = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (err || !isOwner) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		groups.removeCover(data, callback);
	});
};

module.exports = SocketGroups;
