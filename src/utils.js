'use strict';

const crypto = require('crypto');
const nconf = require('nconf');
const path = require('node:path');

process.profile = function (operation, start) {
	console.log('%s took %d milliseconds', operation, process.elapsedTimeSince(start));
};

process.elapsedTimeSince = function (start) {
	const diff = process.hrtime(start);
	return (diff[0] * 1e3) + (diff[1] / 1e6);
};
const utils = { ...require('../public/src/utils.common') };

utils.getLanguage = function () {
	const meta = require('./meta');
	return meta.config && meta.config.defaultLang ? meta.config.defaultLang : 'en-GB';
};

utils.generateUUID = function () {
	// from https://github.com/tracker1/node-uuid4/blob/master/index.js
	let rnd = crypto.randomBytes(16);
	/* eslint-disable no-bitwise */
	rnd[6] = (rnd[6] & 0x0f) | 0x40;
	rnd[8] = (rnd[8] & 0x3f) | 0x80;
	/* eslint-enable no-bitwise */
	rnd = rnd.toString('hex').match(/(.{8})(.{4})(.{4})(.{4})(.{12})/);
	rnd.shift();
	return rnd.join('-');
};

utils.getSass = function () {
	try {
		const sass = require('sass-embedded');
		return sass;
	} catch (_err) {
		return require('sass');
	}
};

utils.getFontawesomePath = function () {
	let packageName = '@fortawesome/fontawesome-free';
	if (nconf.get('fontawesome:pro') === true) {
		packageName = '@fortawesome/fontawesome-pro';
	}
	const pathToMainFile = require.resolve(packageName);
	// main file will be in `js/fontawesome.js` - we need to go up two directories to get to the root of the package
	const fontawesomePath = path.dirname(path.dirname(pathToMainFile));
	return fontawesomePath;
};

utils.getFontawesomeStyles = function () {
	let styles = nconf.get('fontawesome:styles') || '*';
	// "*" is a special case, it means all styles, spread is used to support both string and array (["*"])
	if ([...styles][0] === '*') {
		styles = ['solid', 'brands', 'regular'];
		if (nconf.get('fontawesome:pro')) {
			styles.push('light', 'thin', 'sharp', 'duotone');
		}
	}
	if (!Array.isArray(styles)) {
		styles = [styles];
	}
	return styles;
};

utils.getFontawesomeVersion = function () {
	const fontawesomePath = utils.getFontawesomePath();
	const packageJson = require(path.join(fontawesomePath, 'package.json'));
	return packageJson.version;
};

module.exports = utils;
