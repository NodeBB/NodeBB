'use strict';

const os = require('os');
const winston = require('winston');
const _ = require('lodash');

const meta = require('../meta');
const languages = require('../languages');
const helpers = require('./helpers');

module.exports = function (middleware) {
	middleware.addHeaders = helpers.try(function addHeaders(req, res, next) {
		const headers = {
			'X-Powered-By': encodeURI(meta.config['powered-by'] || 'NodeBB'),
			'Access-Control-Allow-Methods': encodeURI(meta.config['access-control-allow-methods'] || ''),
			'Access-Control-Allow-Headers': encodeURI(meta.config['access-control-allow-headers'] || ''),
		};

		if (meta.config['csp-frame-ancestors']) {
			headers['Content-Security-Policy'] = `frame-ancestors ${meta.config['csp-frame-ancestors']}`;
			if (meta.config['csp-frame-ancestors'] === '\'none\'') {
				headers['X-Frame-Options'] = 'DENY';
			}
		} else {
			headers['Content-Security-Policy'] = 'frame-ancestors \'self\'';
			headers['X-Frame-Options'] = 'SAMEORIGIN';
		}

		if (meta.config['access-control-allow-origin']) {
			let origins = meta.config['access-control-allow-origin'].split(',');
			origins = origins.map(function (origin) {
				return origin && origin.trim();
			});

			if (origins.includes(req.get('origin'))) {
				headers['Access-Control-Allow-Origin'] = encodeURI(req.get('origin'));
				headers.Vary = headers.Vary ? `${headers.Vary}, Origin` : 'Origin';
			}
		}

		if (meta.config['access-control-allow-origin-regex']) {
			let originsRegex = meta.config['access-control-allow-origin-regex'].split(',');
			originsRegex = originsRegex.map(function (origin) {
				try {
					origin = new RegExp(origin.trim());
				} catch (err) {
					winston.error(`[middleware.addHeaders] Invalid RegExp For access-control-allow-origin ${origin}`);
					origin = null;
				}
				return origin;
			});

			originsRegex.forEach(function (regex) {
				if (regex && regex.test(req.get('origin'))) {
					headers['Access-Control-Allow-Origin'] = encodeURI(req.get('origin'));
					headers.Vary = headers.Vary ? `${headers.Vary}, Origin` : 'Origin';
				}
			});
		}

		if (meta.config['access-control-allow-credentials']) {
			headers['Access-Control-Allow-Credentials'] = meta.config['access-control-allow-credentials'];
		}

		if (process.env.NODE_ENV === 'development') {
			headers['X-Upstream-Hostname'] = os.hostname();
		}

		for (const key in headers) {
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
			return _.uniq([defaultLang, ...codes]);
		} catch (err) {
			winston.error(`[middleware/autoLocale] Could not retrieve languages codes list! ${err.stack}`);
			return [defaultLang];
		}
	}
};
