'use strict';

const widgetsController = module.exports;
const admin = require('../../widgets/admin');

widgetsController.get = async function (req, res) {
	const data = await admin.get();
	res.render('admin/extend/widgets', data);
};
