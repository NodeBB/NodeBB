'use strict';

const path = require('path');
const cacheCreate = require('../cache/ttl');
const meta = require('../meta');
const helpers = require('./helpers');
const user = require('../user');

let cache;

const timestampedUploadRegex = /^\d+-.+$/;

exports.clearCache = function () {
	if (cache) {
		cache.clear();
	}
};

exports.ratelimit = helpers.try(async (req, res, next) => {
	const { uid } = req;
	if (!meta.config.uploadRateLimitThreshold || (uid > 0 && await user.isAdminOrGlobalMod(uid))) {
		return next();
	}
	if (!cache) {
		cache = cacheCreate({
			name: 'upload-rate-limit-cache',
			max: 100,
			ttl: meta.config.uploadRateLimitCooldown * 1000,
		});
	}
	const count = (cache.get(`${req.ip}:uploaded_file_count`) || 0) + req.files.length;
	if (count > meta.config.uploadRateLimitThreshold) {
		return next(new Error(['[[error:upload-ratelimit-reached]]']));
	}
	cache.set(`${req.ip}:uploaded_file_count`, count);
	next();
});

exports.privateUploads = helpers.try(function privateUploads(req, res, next) {
	if (req.loggedIn || !meta.config.privateUploads) {
		return next();
	}

	const uploadPrefix = `/uploads/files`;
	const requestPath = normalizeUploadRequestPath(req.path);
	if (requestPath === uploadPrefix || requestPath.startsWith(`${uploadPrefix}/`)) {
		const privateExtensions = (meta.config.privateUploadsExtensions || '')
			.split(',')
			.map(ext => ext.trim().toLowerCase())
			.filter(Boolean);
		let ext = path.extname(requestPath);
		ext = ext ? ext.replace(/^\./, '').trim().toLowerCase() : ext;
		if (!ext || !privateExtensions.length || privateExtensions.includes(ext)) {
			return res.status(403).json('not-allowed');
		}
	}
	next();
});

const unsafeExtensions = new Set([
	'', '.',
	'.html', '.htm', '.xhtml', '.mht', '.mhtml', '.stm', '.shtm', '.shtml',
	'.svg', '.svgz',
	'.xml', '.xsl', '.xslt',
	'.rss', '.atom', '.rpf', '.rng', '.sch', '.dtd', '.epub',
	'.xaml', '.plist', '.vcf', '.opf', '.rdf', '.wsdl', '.resx',
	'.xsd', '.mathml', '.xht',
]);

exports.addUploadHeaders = helpers.try(function addUploadHeaders(req, res, next) {
	const requestedPath = normalizeUploadRequestPath(req.path);
	if (requestedPath.startsWith('/uploads/')) {
		let basename = path.basename(requestedPath);
		const extname = path.extname(requestedPath).trim().toLowerCase();
		// Trim uploaded files' timestamps when downloading + force download if unsafe
		if (timestampedUploadRegex.test(basename)) {
			basename = basename.slice(14);
		}
		res.setHeader('X-Content-Type-Options', 'nosniff');
		if (unsafeExtensions.has(extname)) {
			res.attachment(basename);
		}
	}

	next();
});

function normalizeUploadRequestPath(requestPath) {
	let decodedPath;
	try {
		decodedPath = decodeURIComponent(requestPath);
	} catch (_err) {
		invalidPathError();
	}
	if (decodedPath.includes(':') || /[. ](\/|$)/.test(decodedPath)) {
		invalidPathError();
	}
	return path.posix.normalize(
		decodedPath.replace(/\\/g, '/')
	).toLowerCase();
}

function invalidPathError() {
	const err = new Error('[[error:invalid-path]]');
	err.status = 403;
	err.stack = err.stack.split('\n').slice(0, 1).join('\n');
	throw err;
}
