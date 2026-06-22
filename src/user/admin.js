
'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { AsyncParser } = require('@json2csv/node');

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
		return await db.getSortedSetRevRange(`uid:${uid}:ip`, 0, stop);
	};

	User.getUsersCSV = async function () {
		winston.verbose('[user/getUsersCSV] Compiling User CSV data');

		const { fields, showIps } = await plugins.hooks.fire('filter:user.csvFields', {
			fields: ['uid', 'email', 'username'],
			showIps: false,
		});

		let csvContent = `${fields.map(f => `"${f}"`).join(',')}\n`;
		await batch.processSortedSet('users:joindate', async (uids) => {
			csvContent += await userDataToCsv(uids, fields, [], showIps);
		}, {});

		return csvContent;
	};

	User.exportUsersCSV = async function (fieldsToExport = ['email', 'username', 'uid', 'ip']) {
		winston.verbose('[user/exportUsersCSV] Exporting User CSV data');

		const { fields, showIps } = await plugins.hooks.fire('filter:user.csvFields', {
			fields: fieldsToExport,
			showIps: fieldsToExport.includes('ip'),
		});
		const customUserFields = await db.getSortedSetRange('user-custom-fields', 0, -1);
		if (!showIps && fields.includes('ip')) {
			fields.splice(fields.indexOf('ip'), 1);
		}
		const fd = await fs.promises.open(
			path.join(baseDir, 'build/export', 'users.csv'),
			'w'
		);
		await fs.promises.appendFile(fd, `${fields.map(f => `"${f}"`).join(',')}\n`);
		await batch.processSortedSet('users:joindate', async (uids) => {
			const csv = await userDataToCsv(uids, fields, customUserFields, showIps);
			await fs.promises.appendFile(fd, csv);
		}, {
			batch: 5000,
			interval: 250,
		});
		await fd.close();
	};

	async function userDataToCsv(uids, fields, customUserFields, showIps) {
		const fieldsToWrapInQuotes = ['fullname', 'signature', 'aboutme', ...customUserFields];
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
			fieldsToWrapInQuotes.forEach((field) => {
				if (user[field]) {
					user[field] = `"${String(user[field])}"`;
				}
			});
		});

		const opts = { fields, header: false };
		const json2csvAsync = new AsyncParser(opts);
		return await json2csvAsync.parse(usersData).promise();
	}
};
