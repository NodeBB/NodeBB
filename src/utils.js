'use strict';

process.profile = function (operation, start) {
	console.log('%s took %d milliseconds', operation, process.elapsedTimeSince(start));
};

process.elapsedTimeSince = function (start) {
	const diff = process.hrtime(start);
	return (diff[0] * 1e3) + (diff[1] / 1e6);
};
const utils = require('../public/src/utils.common');

utils.getLanguage = function () {
	const meta = require('./meta');
	return meta.config && meta.config.defaultLang ? meta.config.defaultLang : 'en-GB';
};
module.exports = utils;
