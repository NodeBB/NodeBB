'use strict';

const async = require('async');
const widgets = require('../../widgets');

const Widgets = module.exports;

Widgets.set = function (socket, data, callback) {
	if (!Array.isArray(data)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.eachSeries(data, widgets.setArea, callback);
};
