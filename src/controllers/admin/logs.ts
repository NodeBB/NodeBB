'use strict';

import validator from 'validator';
import winston from 'winston';
import meta from '../../meta';

const logsController = {} as any;

logsController.get = async function (req, res) {
	let logs = '';
	try {
		logs = await meta.logs.get();
	} catch (err: any) {
		winston.error(err.stack);
	}
	res.render('admin/advanced/logs', {
		data: validator.escape(logs),
	});
};

export default logsController;