'use strict';

const request = require('request');

const meta = require('../meta');

let versionCache = '';
let versionCacheLastModified = '';

const isPrerelease = /^v?\d+\.\d+\.\d+-.+$/;

function getLatestVersion(callback) {
	const headers = {
		Accept: 'application/vnd.github.v3+json',
		'User-Agent': encodeURIComponent('NodeBB Admin Control Panel/' + meta.config.title),
	};

	if (versionCacheLastModified) {
		headers['If-Modified-Since'] = versionCacheLastModified;
	}

	request('https://api.github.com/repos/NodeBB/NodeBB/releases/latest', {
		json: true,
		headers: headers,
		timeout: 2000,
	}, function (err, res, latestRelease) {
		if (err) {
			return callback(err);
		}

		if (res.statusCode === 304) {
			return callback(null, versionCache);
		}

		if (res.statusCode !== 200) {
			return callback(new Error(res.statusMessage));
		}

		if (!latestRelease || !latestRelease.tag_name) {
			return callback(new Error('[[error:cant-get-latest-release]]'));
		}
		const tagName = latestRelease.tag_name.replace(/^v/, '');
		versionCache = tagName;
		versionCacheLastModified = res.headers['last-modified'];
		callback(null, versionCache);
	});
}

exports.getLatestVersion = getLatestVersion;
exports.isPrerelease = isPrerelease;

require('../promisify')(exports);
