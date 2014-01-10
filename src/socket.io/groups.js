var	groups = require('../groups'),

	SocketGroups = {};

SocketGroups.create = function(data, callback) {
	groups.create(data.name, data.description, function(err, groupObj) {
		callback(err ? err.message : null, groupObj || undefined);
	});
};

SocketGroups.delete = function(gid, callback) {
	groups.destroy(gid, function(err) {
		callback(err ? err.message : null, err ? null : 'OK');
	});
};

SocketGroups.get = function(gid, callback) {
	groups.get(gid, {
		expand: true
	}, function(err, groupObj) {
		callback(err ? err.message : null, groupObj || undefined);
	});
};

SocketGroups.join = function(data, callback) {
	groups.join(data.gid, data.uid, callback);
};

SocketGroups.leave = function(data, callback) {
	groups.leave(data.gid, data.uid, callback);
};

SocketGroups.update = function(data, callback) {
	groups.update(data.gid, data.values, function(err) {
		callback(err ? err.message : null);
	});
};

module.exports = SocketGroups;