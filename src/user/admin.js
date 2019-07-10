
'use strict';

var winston = require('winston');
var validator = require('validator');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function (User) {
	User.logIP = async function (uid, ip) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}
		var now = Date.now();
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
		var csvContent = '';
		var uids = await db.getSortedSetRange('users:joindate', 0, -1);
		const data = await plugins.fireHook('filter:user.csvFields', { fields: ['uid', 'email', 'username'] });
		const usersData = await User.getUsersFields(uids, data.fields);
		usersData.forEach(function (user) {
			if (user) {
				csvContent += user.email + ',' + user.username + ',' + user.uid + '\n';
			}
		});
		return csvContent;
	};
};
