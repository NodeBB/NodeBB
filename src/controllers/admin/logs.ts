'use strict';

const validator = require('validator');
const winston = require('winston');

const meta = require('../../meta');

const logsController = module.exports;

logsController.get = async function (req, res) {
	let logs = '';
	try {
		logs = await meta.logs.get();
	} catch (err) {
		winston.error(err.stack);
	}
	res.render('admin/advanced/logs', {
		data: validator.escape(logs),
	});
};
