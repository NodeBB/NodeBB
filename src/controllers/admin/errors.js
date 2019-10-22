'use strict';

const json2csv = require('json-2-csv').json2csv;
const util = require('util');

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

const json2csvAsync = util.promisify(function (data, callback) {
	json2csv(data, (err, output) => callback(err, output));
});

errorsController.export = async function (req, res) {
	const data = await meta.errors.get(false);
	const csv = await json2csvAsync(data);
	res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="404.csv"').send(csv);
};
