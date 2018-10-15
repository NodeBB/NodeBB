'use strict';

var pubsub = require('../pubsub');
var LRU = require('lru-cache');

var cache = LRU({
	max: 40000,
	maxAge: 0,
});
cache.hits = 0;
cache.misses = 0;

module.exports = function (Groups) {
	Groups.cache = cache;

	Groups.resetCache = function () {
		pubsub.publish('group:cache:reset');
		cache.reset();
	};

	pubsub.on('group:cache:reset', function () {
		cache.reset();
	});

	Groups.clearCache = function (uid, groupNames) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}
		pubsub.publish('group:cache:del', { uid: uid, groupNames: groupNames });
		groupNames.forEach(function (groupName) {
			cache.del(uid + ':' + groupName);
		});
	};

	pubsub.on('group:cache:del', function (data) {
		if (data && data.groupNames) {
			data.groupNames.forEach(function (groupName) {
				cache.del(data.uid + ':' + groupName);
			});
		}
	});
};
