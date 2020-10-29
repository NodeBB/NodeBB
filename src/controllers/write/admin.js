'use strict';

const meta = require('../../meta');
const privileges = require('../../privileges');

const helpers = require('../helpers');

const Admin = module.exports;

Admin.updateSetting = async (req, res) => {
	const ok = await privileges.admin.can('admin:settings', req.uid);

	if (!ok) {
		return helpers.formatApiResponse(403, res);
	}

	await meta.configs.set(req.params.setting, req.body.value);
	helpers.formatApiResponse(200, res);
};
