'use strict';

const widgets = require('../../widgets');

const Widgets = module.exports;

Widgets.set = async function (socket, data) {
	if (!Array.isArray(data)) {
		throw new Error('[[error:invalid-data]]');
	}
	await widgets.setAreas(data);
};
