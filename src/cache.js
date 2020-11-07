'use strict';

const cacheCreate = require('./cacheCreate');

module.exports = cacheCreate({
	name: 'local',
	max: 4000,
	maxAge: 0,
});
