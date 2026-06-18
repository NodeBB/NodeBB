'use strict';

const { AsyncParser } = require('@json2csv/node');

const meta = require('../../meta');
const analytics = require('../../analytics');
const utils = require('../../utils');

const errorsController = module.exports;

errorsController.get = async function (req, res) {
	const data = await utils.promiseParallel({
		'not-found': meta.errors.get(),
		analytics: analytics.getErrorAnalytics(),
	});
	res.render('admin/advanced/errors', data);
};

errorsController.export = async function (req, res) {
	const data = await meta.errors.get();
	const fields = data.length ? Object.keys(data[0]) : [];
	const opts = { fields };
	const json2csvAsync = new AsyncParser(opts);
	const csv = await json2csvAsync.parse(data).promise();
	res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="404.csv"').send(csv);
};
