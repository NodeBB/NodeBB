'use strict';

const meta = require('../../meta');

const helpers = require('../helpers');

const Admin = module.exports;

Admin.updateSetting = async (req, res) => {
	if (!res.locals.privileges['admin:settings']) {
		return helpers.formatApiResponse(403, res);
	}

	await meta.configs.set(req.params.setting, req.body.value);
	helpers.formatApiResponse(200, res);
};
