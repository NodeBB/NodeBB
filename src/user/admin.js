
'use strict';

const winston = require('winston');
const validator = require('validator');

const db = require('../database');
const plugins = require('../plugins');
const batch = require('../batch');

module.exports = function (User) {
	User.logIP = async function (uid, ip) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}
		const now = Date.now();
		const bulk = [
			['uid:' + uid + ':ip', now, ip || 'Unknown'],
		];
		if (ip) {
			bulk.push(['ip:' + ip + ':uid', now, uid]);
		}
		await db.sortedSetAddBulk(bulk);
	};

	User.getIPs = async function (uid, stop) {
		const ips = await db.getSortedSetRevRange('uid:' + uid + ':ip', 0, stop);
		return ips.map(ip => validator.escape(String(ip)));
	};

	User.getUsersCSV = async function () {
		winston.verbose('[user/getUsersCSV] Compiling User CSV data');

		const data = await plugins.hooks.fire('filter:user.csvFields', { fields: ['uid', 'email', 'username'] });
		let csvContent = data.fields.join(',') + '\n';
		await batch.processSortedSet('users:joindate', async (uids) => {
			const usersData = await User.getUsersFields(uids, data.fields);
			csvContent += usersData.reduce((memo, user) => {
				memo += user.email + ',' + user.username + ',' + user.uid + '\n';
				return memo;
			}, '');
		}, {});

		return csvContent;
	};
};
