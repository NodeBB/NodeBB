'use strict';

const validator = require('validator');

const db = require('../database');
const utils = require('../utils');
const tx = require('../translator');

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

CustomFields.getOptions = function (field) {
	return (field['select-options'] || '').split('\n').filter(Boolean);
};

CustomFields.parseValue = function (field, value) {
	if (field.type !== 'select-multi') {
		return value;
	}

	let values;
	try {
		values = JSON.parse(value || '[]');
	} catch (err) {
		return null;
	}
	return Array.isArray(values) ? values : null;
};

CustomFields.validate = function (field, value) {
	const { type } = field;

	if (typeof value === 'string' && value.length > 255) {
		throw new Error(tx.compile(
			'error:custom-user-field-value-too-long', field.name
		));
	}

	const isUrl = value && validator.isURL(String(value).trim(), {
		require_protocol: true,
		require_valid_protocol: true,
		require_tld: true,
	});

	if (value && type === 'input-number' && !utils.isNumber(value)) {
		throw new Error(tx.compile(
			'error:custom-user-field-invalid-number', field.name
		));
	} else if (value && type === 'input-text' && isUrl) {
		throw new Error(tx.compile(
			'error:custom-user-field-invalid-text', field.name
		));
	} else if (value && type === 'input-date' && !validator.isDate(value)) {
		throw new Error(tx.compile(
			'error:custom-user-field-invalid-date', field.name
		));
	} else if (value && type === 'input-link' && !isUrl) {
		throw new Error(tx.compile(
			'error:custom-user-field-invalid-link', field.name
		));
	} else if (type === 'select') {
		const opts = CustomFields.getOptions(field);
		if (!opts.includes(value) && value !== '') {
			throw new Error(tx.compile(
				'error:custom-user-field-select-value-invalid', field.name
			));
		}
	} else if (type === 'select-multi') {
		const opts = CustomFields.getOptions(field);
		const values = CustomFields.parseValue(field, value);
		if (!values || !values.every(value => opts.includes(value))) {
			throw new Error(tx.compile(
				'error:custom-user-field-select-value-invalid', field.name
			));
		}
	}
};
