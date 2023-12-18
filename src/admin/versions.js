'use strict';

const request = require('../request');
const meta = require('../meta');

let versionCache = '';
let versionCacheLastModified = '';

const isPrerelease = /^v?\d+\.\d+\.\d+-.+$/;
const latestReleaseUrl = 'https://api.github.com/repos/NodeBB/NodeBB/releases/latest';

async function getLatestVersion() {
	const headers = {
		Accept: 'application/vnd.github.v3+json',
		'User-Agent': encodeURIComponent(`NodeBB Admin Control Panel/${meta.config.title}`),
	};

	if (versionCacheLastModified) {
		headers['If-Modified-Since'] = versionCacheLastModified;
	}

	const { body: latestRelease, response } = await request.get(latestReleaseUrl, {
		headers: headers,
		timeout: 2000,
	});
	if (response.statusCode === 304) {
		return versionCache;
	}
	if (response.statusCode !== 200) {
		throw new Error(response.statusText);
	}
	if (!latestRelease || !latestRelease.tag_name) {
		throw new Error('[[error:cant-get-latest-release]]');
	}
	const tagName = latestRelease.tag_name.replace(/^v/, '');
	versionCache = tagName;
	versionCacheLastModified = response.headers['last-modified'];
	return versionCache;
}

exports.getLatestVersion = getLatestVersion;
exports.isPrerelease = isPrerelease;

require('../promisify')(exports);
