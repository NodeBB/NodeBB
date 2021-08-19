'use strict';

const cacheCreate = require('../cacheCreate');
const meta = require('../meta');

module.exports = cacheCreate({
	name: 'post',
	max: meta.config.postCacheSize,
	length: function (n) { return n.length; },
	maxAge: 0,
	enabled: global.env === 'production',
});
