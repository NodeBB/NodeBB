'use strict';

var os = require('os');

var meta = require('../meta');

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
};

