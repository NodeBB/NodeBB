'use strict';

const db = require('../../database');

module.exports = {
	name: 'Update registration type',
	timestamp: Date.UTC(2019, 5, 4),
	method: function (callback) {
		const meta = require('../../meta');
		const registrationType = meta.config.registrationType || 'normal';
		if (registrationType === 'admin-approval' || registrationType === 'admin-approval-ip') {
			db.setObject('config', {
				registrationType: 'normal',
				registrationApprovalType: registrationType,
			}, callback);
		} else {
			setImmediate(callback);
		}
	},
};
