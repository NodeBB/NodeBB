'use strict';

const meta = require('../../meta');
const widgets = require('../../widgets');

const Themes = module.exports;

Themes.getInstalled = async function () {
	return await meta.themes.get();
};

Themes.set = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	if (data.type === 'local') {
		await widgets.saveLocationsOnThemeReset();
	}

	data.ip = socket.ip;
	data.uid = socket.uid;

	await meta.themes.set(data);
};
