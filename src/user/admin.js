
'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const validator = require('validator');

const { baseDir } = require('../constants').paths;
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
			[`uid:${uid}:ip`, now, ip || 'Unknown'],
		];
		if (ip) {
			bulk.push([`ip:${ip}:uid`, now, uid]);
		}
		await db.sortedSetAddBulk(bulk);
	};

	User.getIPs = async function (uid, stop) {
		const ips = await db.getSortedSetRevRange(`uid:${uid}:ip`, 0, stop);
		return ips.map(ip => validator.escape(String(ip)));
	};

	User.getUsersCSV = async function () {
		winston.verbose('[user/getUsersCSV] Compiling User CSV data');

		const data = await plugins.hooks.fire('filter:user.csvFields', { fields: ['uid', 'email', 'username'] });
		let csvContent = `${data.fields.join(',')}\n`;
		await batch.processSortedSet('users:joindate', async (uids) => {
			const usersData = await User.getUsersFields(uids, data.fields);
			csvContent += usersData.reduce((memo, user) => {
				memo += `${data.fields.map(field => user[field]).join(',')}\n`;
				return memo;
			}, '');
		}, {});

		return csvContent;
	};

	User.exportUsersCSV = async function () {
		winston.verbose('[user/exportUsersCSV] Exporting User CSV data');

		const data = await plugins.hooks.fire('filter:user.csvFields', { fields: ['email', 'username', 'uid'] });
		const fd = await fs.promises.open(
			path.join(baseDir, 'build/export', 'users.csv'),
			'w'
		);
		fs.promises.appendFile(fd, `${data.fields.join(',')}\n`);
		await batch.processSortedSet('users:joindate', async (uids) => {
			const usersData = await User.getUsersFields(uids, data.fields.slice());
			let line = '';
			usersData.forEach((user) => {
				line += `${data.fields.map(field => user[field]).join(',')}\n`;
			});

			await fs.promises.appendFile(fd, line);
		}, {
			batch: 5000,
			interval: 250,
		});
		await fd.close();
	};
};
