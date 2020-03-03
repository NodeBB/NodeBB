'use strict';

const meta = require('../../meta');
const widgets = require('../../widgets');

const Themes = module.exports;

Themes.getInstalled = function (socket, data, callback) {
	meta.themes.get(callback);
};

Themes.set = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	if (data.type === 'local') {
		await widgets.reset();
	}

	data.ip = socket.ip;
	data.uid = socket.uid;

	await meta.themes.set(data);
};
