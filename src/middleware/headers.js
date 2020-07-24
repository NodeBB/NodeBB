'use strict';

var os = require('os');
var winston = require('winston');
var _ = require('lodash');

var meta = require('../meta');
var languages = require('../languages');
var helpers = require('./helpers');

module.exports = function (middleware) {
	middleware.addHeaders = helpers.try(function addHeaders(req, res, next) {
		var headers = {
			'X-Powered-By': encodeURI(meta.config['powered-by'] || 'NodeBB'),
			'X-Frame-Options': meta.config['allow-from-uri'] ? 'ALLOW-FROM ' + encodeURI(meta.config['allow-from-uri']) : 'SAMEORIGIN',
			'Access-Control-Allow-Methods': encodeURI(meta.config['access-control-allow-methods'] || ''),
			'Access-Control-Allow-Headers': encodeURI(meta.config['access-control-allow-headers'] || ''),
		};

		if (meta.config['access-control-allow-origin']) {
			var origins = meta.config['access-control-allow-origin'].split(',');
			origins = origins.map(function (origin) {
				return origin && origin.trim();
			});

			if (origins.includes(req.get('origin'))) {
				headers['Access-Control-Allow-Origin'] = encodeURI(req.get('origin'));
			}
		}

		if (meta.config['access-control-allow-origin-regex']) {
			var originsRegex = meta.config['access-control-allow-origin-regex'].split(',');
			originsRegex = originsRegex.map(function (origin) {
				try {
					origin = new RegExp(origin.trim());
				} catch (err) {
					winston.error('[middleware.addHeaders] Invalid RegExp For access-control-allow-origin ' + origin);
					origin = null;
				}
				return origin;
			});

			originsRegex.forEach(function (regex) {
				if (regex && regex.test(req.get('origin'))) {
					headers['Access-Control-Allow-Origin'] = encodeURI(req.get('origin'));
				}
			});
		}

		if (meta.config['access-control-allow-credentials']) {
			headers['Access-Control-Allow-Credentials'] = meta.config['access-control-allow-credentials'];
		}

		if (process.env.NODE_ENV === 'development') {
			headers['X-Upstream-Hostname'] = os.hostname();
		}

		for (var key in headers) {
			if (headers.hasOwnProperty(key) && headers[key]) {
				res.setHeader(key, headers[key]);
			}
		}

		next();
	});

	middleware.autoLocale = helpers.try(async function autoLocale(req, res, next) {
		let langs;
		if (req.query.lang) {
			langs = await listCodes();
			if (!langs.includes(req.query.lang)) {
				req.query.lang = meta.config.defaultLang;
			}
			return next();
		}
		if (parseInt(req.uid, 10) > 0 || !meta.config.autoDetectLang) {
			return next();
		}
		langs = await listCodes();
		const lang = req.acceptsLanguages(langs);
		if (!lang) {
			return next();
		}
		req.query.lang = lang;
		next();
	});

	async function listCodes() {
		const defaultLang = meta.config.defaultLang || 'en-GB';
		try {
			const codes = await languages.listCodes();
			winston.verbose('[middleware/autoLocale] Retrieves languages list for middleware');
			return _.uniq([defaultLang, ...codes]);
		} catch (err) {
			winston.error('[middleware/autoLocale] Could not retrieve languages codes list! ' + err.stack);
			return [defaultLang];
		}
	}
};
