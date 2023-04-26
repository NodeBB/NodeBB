'use strict';


const db = require('../../database');

module.exports = {
	name: 'Reset bootswatch skin',
	timestamp: Date.UTC(2023, 3, 24),
	method: async function () {
		const config = await db.getObject('config');
		const currentSkin = config.bootswatchSkin || '';
		const css = require('../../meta/css');
		if (currentSkin && !css.supportedSkins.includes(currentSkin)) {
			await db.setObjectField('config', 'bootswatchSkin', '');
		}
	},
};
