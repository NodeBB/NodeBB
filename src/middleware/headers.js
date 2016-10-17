'use strict';


var _ = require('underscore');

var meta = require('../meta');

module.exports = function (middleware) {

	middleware.addHeaders = function (req, res, next) {
		var defaults = {
			'X-Powered-By': 'NodeBB',
			'X-Frame-Options': 'SAMEORIGIN',
			'Access-Control-Allow-Origin': 'null'	// yes, string null.
		};
		var headers = {
			'X-Powered-By': meta.config['powered-by'],
			'X-Frame-Options': meta.config['allow-from-uri'] ? 'ALLOW-FROM ' + meta.config['allow-from-uri'] : undefined,
			'Access-Control-Allow-Origin': meta.config['access-control-allow-origin'],
			'Access-Control-Allow-Methods': meta.config['access-control-allow-methods'],
			'Access-Control-Allow-Headers': meta.config['access-control-allow-headers']
		};

		_.defaults(headers, defaults);
		headers = _.pick(headers, Boolean);		// Remove falsy headers

		for (var key in headers) {
			if (headers.hasOwnProperty(key)) {
				res.setHeader(key, encodeURIComponent(headers[key]));
			}
		}

		next();
	};

	middleware.addExpiresHeaders = function (req, res, next) {
		if (req.app.enabled('cache')) {
			res.setHeader("Cache-Control", "public, max-age=5184000");
			res.setHeader("Expires", new Date(Date.now() + 5184000000).toUTCString());
		} else {
			res.setHeader("Cache-Control", "public, max-age=0");
			res.setHeader("Expires", new Date().toUTCString());
		}

		next();
	};

};



