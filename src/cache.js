'use strict';

const cacheCreate = require('./cache/lru');

module.exports = cacheCreate({
	name: 'local',
	max: 40000,
	ttl: 0,
});
