'use strict';

const url = require('url');

// creates a slimmed down version of the request object
exports.buildReqObject = (req, payload) => {
	req = req || {};
	const headers = req.headers || {};
	const encrypted = req.connection ? !!req.connection.encrypted : false;
	let host = headers.host;
	const referer = headers.referer || '';

	if (!host) {
		host = url.parse(referer).host || '';
	}

	return {
		uid: req.uid,
		params: req.params,
		method: req.method,
		body: payload || req.body,
		ip: req.ip,
		host: host,
		protocol: encrypted ? 'https' : 'http',
		secure: encrypted,
		url: referer,
		path: referer.substr(referer.indexOf(host) + host.length),
		headers: headers,
	};
};
