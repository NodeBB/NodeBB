'use strict';

import user from '../../user';
const authenticationController = require('../authentication');
import helpers from '../helpers';

const Utilities  = {} as any;

Utilities.ping = {} as any;
Utilities.ping.get = (req, res) =>{
	helpers.formatApiResponse(200, res, {
		pong: true,
	});
};

Utilities.ping.post = (req, res) =>{
	helpers.formatApiResponse(200, res, {
		uid: req.user.uid,
		received: req.body,
	});
};

Utilities.login = (req, res) =>{
	res.locals.redirectAfterLogin = async (req, res) => {
		const userData = (await user.getUsers([req.uid], req.uid)).pop();
		helpers.formatApiResponse(200, res, userData);
	};
	res.locals.noScriptErrors = (req, res, err, statusCode: number) => {
		helpers.formatApiResponse(statusCode, res, new Error(err));
	};

	authenticationController.login(req, res);
};
