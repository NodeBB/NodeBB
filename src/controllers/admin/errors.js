'use strict';

const json2csvAsync = require('json2csv').parseAsync;

const meta = require('../../meta');
const analytics = require('../../analytics');
const utils = require('../../utils');

const errorsController = module.exports;

errorsController.get = async function (req, res) {
	const data = await utils.promiseParallel({
		'not-found': meta.errors.get(true),
		analytics: analytics.getErrorAnalytics(),
	});
	res.render('admin/advanced/errors', data);
};

errorsController.export = async function (req, res) {
	const data = await meta.errors.get(false);
	const fields = data.length ? Object.keys(data[0]) : [];
	const opts = { fields };
	const csv = await json2csvAsync(data, opts);
	res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="404.csv"').send(csv);
};
