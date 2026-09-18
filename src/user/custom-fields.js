'use strict';

const db = require('../database');

const CustomFields = module.exports;

CustomFields.getKeys = async function () {
	return await db.getSortedSetRange('user-custom-fields', 0, -1);
};

CustomFields.getFields = async function () {
	const keys = await CustomFields.getKeys();
	return (await db.getObjects(keys.map(k => `user-custom-field:${k}`))).filter(Boolean);
};

CustomFields.setFields = async function (fields) {
	const keys = await CustomFields.getKeys();
	await db.delete('user-custom-fields');
	await db.deleteAll(keys.map(k => `user-custom-field:${k}`));

	await db.sortedSetAdd(
		'user-custom-fields',
		fields.map((f, i) => i),
		fields.map(f => f.key)
	);
	await db.setObjectBulk(
		fields.map(field => [`user-custom-field:${field.key}`, field])
	);
};
