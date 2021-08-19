'use strict';

const cacheCreate = require('./cacheCreate');

module.exports = cacheCreate({
	name: 'local',
	max: 40000,
	maxAge: 0,
});
