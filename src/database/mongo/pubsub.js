'use strict';

var nconf = require('nconf');

module.exports = function (db, mongoModule) {
	var pubsub;

	if (!nconf.get('redis')) {
		var mubsub = require('mubsub');
		var client = mubsub(db);
		pubsub = client.channel('pubsub');
		mongoModule.pubsub = pubsub;
	} else {
		pubsub = require('../../pubsub');
	}

	pubsub.on('mongo:hash:cache:del', function (key) {
		mongoModule.objectCache.del(key);
	});

	pubsub.on('mongo:hash:cache:reset', function () {
		mongoModule.objectCache.reset();
	});

	mongoModule.delObjectCache = function (key) {
		pubsub.publish('mongo:hash:cache:del', key);
		mongoModule.objectCache.del(key);
	};

	mongoModule.resetObjectCache = function () {
		pubsub.publish('mongo:hash:cache:reset');
		mongoModule.objectCache.reset();
	};
};
