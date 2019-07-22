'use strict';

const nconf = require('nconf');
const admin = require('./admin');
const translator = require('../translator');
const groups = require('../groups');

const navigation = module.exports;

navigation.get = async function (uid) {
	let data = await admin.get();

	data = data.filter(item => item && item.enabled).map(function (item) {
		item.originalRoute = item.route;

		if (!item.route.startsWith('http')) {
			item.route = nconf.get('relative_path') + item.route;
		}

		Object.keys(item).forEach(function (key) {
			item[key] = translator.unescape(item[key]);
		});

		return item;
	});

	const pass = await Promise.all(data.map(async function (navItem) {
		if (!navItem.groups.length) {
			return true;
		}
		return await groups.isMemberOfAny(uid, navItem.groups);
	}));
	return data.filter((navItem, i) => pass[i]);
};

require('../promisify')(navigation);
