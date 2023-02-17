'use strict';

const { csrfSync } = require('csrf-sync');

const {
	generateToken,
	csrfSynchronisedProtection,
} = csrfSync({
	getTokenFromRequest: (req) => {
		if (req.headers['x-csrf-token']) {
			return req.headers['x-csrf-token'];
		} else if (req.body.csrf_token) {
			return req.body.csrf_token;
		}
	},
	size: 64,
});

module.exports = {
	generateToken,
	csrfSynchronisedProtection,
};
