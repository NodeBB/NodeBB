
'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const validator = require('validator');
const json2csvAsync = require('json2csv').parseAsync;

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

	User.exportUsersCSV = async function (fieldsToExport = ['email', 'username', 'uid', 'ip']) {
		winston.verbose('[user/exportUsersCSV] Exporting User CSV data');

		const { fields, showIps } = await plugins.hooks.fire('filter:user.csvFields', {
			fields: fieldsToExport,
			showIps: fieldsToExport.includes('ip'),
		});

		if (!showIps && fields.includes('ip')) {
			fields.splice(fields.indexOf('ip'), 1);
		}
		const fd = await fs.promises.open(
			path.join(baseDir, 'build/export', 'users.csv'),
			'w'
		);
		fs.promises.appendFile(fd, `${fields.map(f => `"${f}"`).join(',')}\n`);
		await batch.processSortedSet('group:administrators:members', async (uids) => {
			const userFieldsToLoad = fields.filter(field => field !== 'ip' && field !== 'password');
			const usersData = await User.getUsersFields(uids, userFieldsToLoad);
			let userIps = [];
			if (showIps) {
				userIps = await db.getSortedSetsMembers(uids.map(uid => `uid:${uid}:ip`));
			}

			usersData.forEach((user, index) => {
				if (Array.isArray(userIps[index])) {
					user.ip = userIps[index].join(',');
				}
			});

			const opts = { fields, header: false };
			const csv = await json2csvAsync(usersData, opts);
			await fs.promises.appendFile(fd, csv);
		}, {
			batch: 5000,
			interval: 250,
		});
		await fd.close();
	};
};
