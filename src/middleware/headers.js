'use strict';

var os = require('os');
var winston = require('winston');
var _ = require('lodash');

var meta = require('../meta');
var languages = require('../languages');

module.exports = function (middleware) {
	middleware.addHeaders = function (req, res, next) {
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
	};

	let langs = [];
	middleware.autoLocale = function (req, res, next) {
		if (parseInt(req.uid, 10) > 0 || !meta.config.autoDetectLang) {
			return next();
		}

		var lang = req.acceptsLanguages(langs);
		if (!lang) {
			return next();
		}
		req.query.lang = lang;
		next();
	};

	languages.listCodes(function (err, codes) {
		if (err) {
			winston.error('[middleware/autoLocale] Could not retrieve languages codes list!');
			codes = [];
		}

		winston.verbose('[middleware/autoLocale] Retrieves languages list for middleware');
		var defaultLang = meta.config.defaultLang || 'en-GB';

		langs = _.uniq([defaultLang, ...codes]);
	});
};
