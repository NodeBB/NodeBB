
'use strict';

import * as fs from 'fs';
import path from 'path';import winston from 'winston';
const validator = require('validator');

const { baseDir } = require('../constants').paths;
import * as database from '../database';
const db = database as any;

const plugins = require('../plugins');
const batch = require('../batch');

export default  function (User) {
	User.logIP = async function (uid: string, ip: string) {
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

	User.getIPs = async function (uid: string, stop: number) {
		const ips = await db.getSortedSetRevRange(`uid:${uid}:ip`, 0, stop);
		return ips.map((ip: string) => validator.escape(String(ip)));
	};

	User.getUsersCSV = async function () {
		winston.verbose('[user/getUsersCSV] Compiling User CSV data');

		const data = await plugins.hooks.fire('filter:user.csvFields', { fields: ['uid', 'email', 'username'] });
		let csvContent = `${data.fields.join(',')}\n`;
		await batch.processSortedSet('users:joindate', async (uids: string[]) => {
			const usersData = await User.getUsersFields(uids, data.fields);
			csvContent += usersData.reduce((memo: string, user) => {
				memo += `${data.fields.map((field) => user[field]).join(',')}\n`;
				return memo;
			}, '');
		}, {});

		return csvContent;
	};

	User.exportUsersCSV = async function () {
		winston.verbose('[user/exportUsersCSV] Exporting User CSV data');

		const { fields, showIps } = await plugins.hooks.fire('filter:user.csvFields', {
			fields: ['email', 'username', 'uid'],
			showIps: true,
		});
		const fd = await fs.promises.open(
			path.join(baseDir, 'build/export', 'users.csv'),
			'w'
		);
		fs.promises.appendFile(fd, `${fields.join(',')}${showIps ? ',ip' : ''}\n`);
		await batch.processSortedSet('users:joindate', async (uids: string[]) => {
			const usersData = await User.getUsersFields(uids, fields.slice());
			let userIPs = '';
			let ips : any[] = [];

			if (showIps) {
				ips = await db.getSortedSetsMembers(uids.map(uid => `uid:${uid}:ip`));
			}

			let line = '';
			usersData.forEach((user, index: number) => {
				line += `${fields.map((field: string) => user[field]).join(',')}`;
				if (showIps) {
					userIPs = ips[index] ? ips[index].join(',') : '';
					line += `,"${userIPs}"\n`;
				} else {
					line += '\n';
				}
			});

			await fs.promises.appendFile(fd, line);
		}, {
			batch: 5000,
			interval: 250,
		});
		await fd.close();
	};
};
