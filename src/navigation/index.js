'use strict';

const nconf = require('nconf');
const validator = require('validator');
const admin = require('./admin');
const groups = require('../groups');

const navigation = module.exports;

const relative_path = nconf.get('relative_path');

navigation.get = async function (uid) {
	let data = await admin.get();

	data = data.filter(item => item && item.enabled).map((item) => {
		item.originalRoute = validator.unescape(item.route);

		if (!item.route.startsWith('http')) {
			item.route = relative_path + item.route;
		}

		return item;
	});

	const pass = await Promise.all(data.map(async (navItem) => {
		if (!navItem.groups.length) {
			return true;
		}
		return await groups.isMemberOfAny(uid, navItem.groups);
	}));
	return data.filter((navItem, i) => pass[i]);
};

require('../promisify')(navigation);
