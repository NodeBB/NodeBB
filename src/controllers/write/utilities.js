'use strict';

const user = require('../../user');
const authenticationController = require('../authentication');
const slugify = require('../../slugify');
const helpers = require('../helpers');

const Utilities = module.exports;

Utilities.ping = {};
Utilities.ping.get = (req, res) => {
	helpers.formatApiResponse(200, res, {
		pong: true,
	});
};

Utilities.ping.post = (req, res) => {
	helpers.formatApiResponse(200, res, {
		uid: req.user.uid,
		received: req.body,
	});
};

Utilities.login = (req, res) => {
	res.locals.continueLogin = async (strategy, req, res) => {
		const { username, password } = req.body;

		const userslug = slugify(username);
		const uid = await user.getUidByUserslug(userslug);
		let ok = false;
		try {
			ok = await user.isPasswordCorrect(uid, password, req.ip);
		} catch (err) {
			if (err.message === '[[error:account-locked]]') {
				return helpers.formatApiResponse(429, res, err);
			}
		}

		if (ok) {
			const userData = await user.getUsers([uid], uid);
			helpers.formatApiResponse(200, res, userData.pop());
		} else {
			helpers.formatApiResponse(403, res);
		}
	};
	res.locals.noScriptErrors = (req, res, err, statusCode) => {
		helpers.formatApiResponse(statusCode, res, new Error(err));
	};

	authenticationController.login(req, res);
};
