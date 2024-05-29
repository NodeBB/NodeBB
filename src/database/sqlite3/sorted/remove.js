'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');

	module.sortedSetRemove = async function (key, values) {
		if (!key) {
			return;
		}
		if (!values || (Array.isArray(values) && !values.length)) {
			return;
		}
		values = helpers.valuesToStrings(values);

		if (!Array.isArray(key)) {
			key = [key];
		}

		const [params, keyList] = helpers.listParams({}, key);
		const [, valueList] = helpers.listParams(params, values, 'value');
		const res = module.db.prepare(`
		DELETE FROM "legacy_zset"
		WHERE "_key" IN (${keyList})
			AND "value" IN (${valueList})`).run(params);
	};

	module.sortedSetsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		value = helpers.valueToString(value);

		const [params, keyList] = helpers.listParams({ value }, keys);
		module.db.prepare(`
		DELETE FROM "legacy_zset"
		WHERE "_key" IN (${keyList})
			AND "value" = @value`).run(params);
	};

	module.sortedSetsRemoveRangeByScore = async function (keys, min, max) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		if (min === '-inf') {
			min = null;
		}
		if (max === '+inf') {
			max = null;
		}

		const [ params, keyList ] = helpers.listParams({ min, max }, keys);
		module.db.prepare(`
		DELETE FROM "legacy_zset"
		WHERE "_key" IN (${keyList})
			AND ("score" >= @min OR @min IS NULL)
			AND ("score" <= @max OR @max IS NULL)`).run(params);
	};

	module.sortedSetRemoveBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		const params = {}, list = [];
		for (const [ key, value ] of data) {
			const keyName = `key${list.length}`;
			const valueName = `value${list.length}`;
			params[keyName] = key;
			params[valueName] = helpers.valueToString(value);
			list.push(`(@${keyName},@${valueName})`);
		}

		module.db.prepare(`
		DELETE FROM "legacy_zset"
		WHERE (_key, value) IN (${list})`).run(params);
	};
};
