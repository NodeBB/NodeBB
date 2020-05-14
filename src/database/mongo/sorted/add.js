'use strict';

module.exports = function (module) {
	var helpers = require('../helpers');
	var utils = require('../../../utils');

	module.sortedSetAdd = async function (key, score, value) {
		if (!key) {
			return;
		}
		if (Array.isArray(score) && Array.isArray(value)) {
			return await sortedSetAddBulk(key, score, value);
		}
		if (!utils.isNumber(score)) {
			throw new Error('[[error:invalid-score, ' + score + ']]');
		}
		value = helpers.valueToString(value);

		try {
			await module.client.collection('objects').updateOne({ _key: key, value: value }, { $set: { score: parseFloat(score) } }, { upsert: true, w: 1, collation: { locale: 'en_US', numericOrdering: true } });
		} catch (err) {
			if (err && err.message.startsWith('E11000 duplicate key error')) {
				return await module.sortedSetAdd(key, score, value);
			}
			throw err;
		}
	};

	async function sortedSetAddBulk(key, scores, values) {
		if (!scores.length || !values.length) {
			return;
		}
		if (scores.length !== values.length) {
			throw new Error('[[error:invalid-data]]');
		}
		for (let i = 0; i < scores.length; i += 1) {
			if (!utils.isNumber(scores[i])) {
				throw new Error('[[error:invalid-score, ' + scores[i] + ']]');
			}
		}
		values = values.map(helpers.valueToString);

		var updates = [];
		for (var i = 0; i < scores.length; i += 1) {
			updates.push({
				updateOne: {
					q: { _key: key, value: values[i] },
					u: { $set: { score: parseFloat(scores[i]) } },
					upsert: true,
					collation: { locale: 'en_US', numericOrdering: true },
				},
			});
		}
		await module.client.collection('objects').bulkWrite(updates);
	}

	module.sortedSetsAdd = async function (keys, scores, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const isArrayOfScores = Array.isArray(scores);
		if ((!isArrayOfScores && !utils.isNumber(scores)) ||
			(isArrayOfScores && scores.map(s => utils.isNumber(s)).includes(false))) {
			throw new Error('[[error:invalid-score, ' + scores + ']]');
		}

		if (isArrayOfScores && scores.length !== keys.length) {
			throw new Error('[[error:invalid-data]]');
		}

		value = helpers.valueToString(value);

		var updates = [];
		for (var i = 0; i < keys.length; i += 1) {
			updates.push({
				updateOne: {
					q: { _key: keys[i], value: value },
					u: { $set: { score: parseFloat(isArrayOfScores ? scores[i] : scores) } },
					upsert: true,
					collation: { locale: 'en_US', numericOrdering: true },
				},
			});
		}
		await module.client.collection('objects').bulkWrite(updates);
	};

	module.sortedSetAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		var updates = [];
		data.forEach(function (item) {
			if (!utils.isNumber(item[1])) {
				throw new Error('[[error:invalid-score, ' + item[1] + ']]');
			}
			updates.push({
				updateOne: {
					q: { _key: item[0], value: String(item[2]) },
					u: { $set: { score: parseFloat(item[1]) } },
					upsert: true,
					collation: { locale: 'en_US', numericOrdering: true },
				},
			});
		});
		await module.client.collection('objects').bulkWrite(updates);
	};
};
