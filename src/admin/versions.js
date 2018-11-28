'use strict';

var semver = require('semver');
var request = require('request');

var meta = require('../meta');

var versionCache = '';
var versionCacheLastModified = '';

var	isPrerelease = /^v?\d+\.\d+\.\d+-.+$/;

function getLatestVersion(callback) {
	var headers = {
		Accept: 'application/vnd.github.v3+json',
		'User-Agent': encodeURIComponent('NodeBB Admin Control Panel/' + meta.config.title),
	};

	if (versionCacheLastModified) {
		headers['If-Modified-Since'] = versionCacheLastModified;
	}

	request('https://api.github.com/repos/NodeBB/NodeBB/tags', {
		json: true,
		headers: headers,
		timeout: 1000,
	}, function (err, res, releases) {
		if (err) {
			return callback(err);
		}

		if (res.statusCode === 304) {
			return callback(null, versionCache);
		}

		if (res.statusCode !== 200) {
			return callback(Error(res.statusMessage));
		}

		releases = releases.filter(function (version) {
			return !isPrerelease.test(version.name);	// filter out automated prerelease versions
		}).map(function (version) {
			return version.name.replace(/^v/, '');
		}).sort(function (a, b) {
			return semver.lt(a, b) ? 1 : -1;
		});

		versionCache = releases[0];
		versionCacheLastModified = res.headers['last-modified'];

		callback(null, versionCache);
	});
}

exports.getLatestVersion = getLatestVersion;
exports.isPrerelease = isPrerelease;
