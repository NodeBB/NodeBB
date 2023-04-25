'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');
	const util = require('util');
	const nconf = require('nconf');
	const connection = require('./connection');
	const _ = require('lodash');
	const sleep = util.promisify(setTimeout);

	require('./sorted/add')(module);
	require('./sorted/remove')(module);
	require('./sorted/union')(module);
	require('./sorted/intersect')(module);

	module.getSortedSetRange = async function (key, start, stop) {
		return await getSortedSetRange(key, start, stop, 1, false);
	};

	module.getSortedSetRevRange = async function (key, start, stop) {
		return await getSortedSetRange(key, start, stop, -1, false);
	};

	module.getSortedSetRangeWithScores = async function (key, start, stop) {
		return await getSortedSetRange(key, start, stop, 1, true);
	};

	module.getSortedSetRevRangeWithScores = async function (key, start, stop) {
		return await getSortedSetRange(key, start, stop, -1, true);
	};

	async function getSortedSetRange(key, start, stop, sort, withScores) {
		if (!key) {
			return;
		}

		if (start < 0 && start > stop) {
			return [];
		}

		let reverse = false;
		if (start === 0 && stop < -1) {
			reverse = true;
			sort *= -1;
			start = Math.abs(stop + 1);
			stop = -1;
		} else if (start < 0 && stop > start) {
			const tmp1 = Math.abs(stop + 1);
			stop = Math.abs(start + 1);
			start = tmp1;
		}

		let limit = stop - start + 1;
		if (limit <= 0) {
			limit = -1;
		}

		const [params, keyList] = helpers.listParams({ limit, start }, key);
		let rows = module.db.prepare(`
		SELECT z."value",
					 z."score"
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" IN (${keyList})
		ORDER BY z."score" ${sort > 0 ? 'ASC' : 'DESC'}
		LIMIT @limit
		OFFSET @start`).all(params);

		if (reverse) {
			rows.reverse();
		}

		if (withScores) {
			rows = rows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
		} else {
			rows = rows.map(r => r.value);
		}

		return rows;
	}

	module.getSortedSetRangeByScore = async function (key, start, count, min, max) {
		return await getSortedSetRangeByScore(key, start, count, min, max, 1, false);
	};

	module.getSortedSetRevRangeByScore = async function (key, start, count, max, min) {
		return await getSortedSetRangeByScore(key, start, count, min, max, -1, false);
	};

	module.getSortedSetRangeByScoreWithScores = async function (key, start, count, min, max) {
		return await getSortedSetRangeByScore(key, start, count, min, max, 1, true);
	};

	module.getSortedSetRevRangeByScoreWithScores = async function (key, start, count, max, min) {
		return await getSortedSetRangeByScore(key, start, count, min, max, -1, true);
	};

	async function getSortedSetRangeByScore(key, start, count, min, max, sort, withScores) {
		if (!key) {
			return;
		}

		if (min === '-inf') {
			min = null;
		}
		if (max === '+inf') {
			max = null;
		}

		const [ params, keyList ] = helpers.listParams({ count, start, min, max }, key);
		let rows = module.db.prepare(`
		SELECT z."value",
       		 z."score"
  	FROM "legacy_object_live" o
 		INNER JOIN "legacy_zset" z
       ON o."_key" = z."_key"
      AND o."type" = z."type"
 		WHERE o."_key" IN (${keyList})
   		AND (z."score" >= @min OR @min IS NULL)
   		AND (z."score" <= @max OR @max IS NULL)
 		ORDER BY z."score" ${sort > 0 ? 'ASC' : 'DESC'}
 		LIMIT @count
		OFFSET @start`).all(params);

		if (withScores) {
			rows = rows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
		} else {
			rows = rows.map(r => r.value);
		}

		return rows;
	}

	module.sortedSetCount = async function (key, min, max) {
		if (!key) {
			return;
		}

		if (min === '-inf') {
			min = null;
		}
		if (max === '+inf') {
			max = null;
		}

		const params = { key, min, max };
		const res = module.db.prepare(`
		SELECT COUNT(*) c
  	FROM "legacy_object_live" o
 		INNER JOIN "legacy_zset" z
       ON o."_key" = z."_key"
      AND o."type" = z."type"
 		WHERE o."_key" = @key
   		AND (z."score" >= @min OR @min IS NULL)
   		AND (z."score" <= @max OR @max IS NULL)`).get(params);

		return res.c;
	};

	module.sortedSetCard = async function (key) {
		if (!key) {
			return 0;
		}

		const params = { key };
		const res = module.db.prepare(`
		SELECT COUNT(*) c
  	FROM "legacy_object_live" o
 		INNER JOIN "legacy_zset" z
       ON o."_key" = z."_key"
      AND o."type" = z."type"
 		WHERE o."_key" = @key`).get(params);

		return res.c;
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const [ params, keyList ] = helpers.listParams({}, keys);
		const rows = module.db.prepare(`
		SELECT o."_key" k,
       		 COUNT(*) c
  	FROM "legacy_object_live" o
 		INNER JOIN "legacy_zset" z
       ON o."_key" = z."_key"
      AND o."type" = z."type"
 		WHERE o."_key" IN (${keyList})
 		GROUP BY o."_key"`).all(params);

		return keys.map(k => (rows.find(r => r.k === k) || { c: 0 }).c);
	};

	module.sortedSetsCardSum = async function (keys) {
		if (!keys || (Array.isArray(keys) && !keys.length)) {
			return 0;
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		const counts = await module.sortedSetsCard(keys);
		const sum = counts.reduce((acc, val) => acc + val, 0);
		return sum;
	};

	module.sortedSetRank = async function (key, value) {
		const result = await getSortedSetRank('ASC', [key], [value]);
		return result ? result[0] : null;
	};

	module.sortedSetRevRank = async function (key, value) {
		const result = await getSortedSetRank('DESC', [key], [value]);
		return result ? result[0] : null;
	};

	async function getSortedSetRank(sort, keys, values) {
		const [params, keyList] = helpers.listParams({}, _.uniq(keys));
		const rows = module.db.prepare(`
		SELECT z."_key" k, z."value" v
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" IN (${keyList})
		ORDER BY o."_key" ASC, 
						 z."score" ${sort},
						 z."value" ${sort}`).all(params);

		return keys.map((key, i) => {
			const value = values[i];
			const list = rows.filter(r => r.k === key);
			const index = list.findIndex(r => r.v == value);
			return index !== -1 ? index : null;
		});
	}

	module.sortedSetsRanks = async function (keys, values) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		return await getSortedSetRank('ASC', keys, values);
	};

	module.sortedSetsRevRanks = async function (keys, values) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		return await getSortedSetRank('DESC', keys, values);
	};

	module.sortedSetRanks = async function (key, values) {
		if (!Array.isArray(values) || !values.length) {
			return [];
		}

		return await getSortedSetRank('ASC', new Array(values.length).fill(key), values);
	};

	module.sortedSetRevRanks = async function (key, values) {
		if (!Array.isArray(values) || !values.length) {
			return [];
		}

		return await getSortedSetRank('DESC', new Array(values.length).fill(key), values);
	};

	module.sortedSetScore = async function (key, value) {
		if (!key) {
			return null;
		}

		value = helpers.valueToString(value);

		const params = { key, value };
		const res = module.db.prepare(`
		SELECT z."score" s
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" = @key
			AND z."value" = @value`).get(params);
		
		return res ? res.s : null;
	};

	module.sortedSetsScore = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		value = helpers.valueToString(value);

		const [params, keyList] = helpers.listParams({ value }, keys);
		const rows = module.db.prepare(`
		SELECT o."_key" k,
					 z."score" s
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" IN (${keyList})
			AND z."value" = @value`).all(params);

		return keys.map((k) => {
			const s = rows.find(r => r.k === k);
			return s ? s.s : null;
		});
	};

	module.sortedSetScores = async function (key, values) {
		if (!key) {
			return null;
		}
		if (!values.length) {
			return [];
		}
		values = helpers.valuesToStrings(values);

		const [params, valueList] = helpers.listParams({ key }, values, 'value');
		const rows = module.db.prepare(`
		SELECT z."value" v,
					 z."score" s
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
		 	 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" = @key
			AND z."value" IN (${valueList})`).all(params);

		return values.map((v) => {
			const s = rows.find(r => r.v === v);
			return s ? s.s : null;
		});
	};

	module.isSortedSetMember = async function (key, value) {
		if (!key) {
			return;
		}

		value = helpers.valueToString(value);

		const params = { key, value };
		const rows = module.db.prepare(`
		SELECT 1
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" = @key
			AND z."value" = @value`).all(params);

		return !!rows.length;
	};

	module.isSortedSetMembers = async function (key, values) {
		if (!key) {
			return;
		}

		if (!values.length) {
			return [];
		}
		values = helpers.valuesToStrings(values);

		const [ params, valueList ] = helpers.listParams({ key }, values, 'value')
		const rows = module.db.prepare(`
		SELECT z."value" v
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" = @key
			AND z."value" IN (${valueList})`).all(params);

		return values.map(v => rows.some(r => r.v === v));
	};

	module.isMemberOfSortedSets = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		value = helpers.valueToString(value);

		const [ params, keyList ] = helpers.listParams({ value }, keys);
		const rows = module.db.prepare(`
		SELECT o."_key" k
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" IN (${keyList})
			AND z."value" = @value`).all(params);

		return keys.map(k => rows.some(r => r.k === k));
	};

	module.getSortedSetMembers = async function (key) {
		const data = await module.getSortedSetsMembers([key]);
		return data && data[0];
	};

	module.getSortedSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const [ params, keyList ] = helpers.listParams({}, keys);
		const rows = module.db.prepare(`
		SELECT z."_key" k, z."value" m
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" IN (${keyList})
		ORDER BY z."score" ASC`).all(params);

		return keys.map(k => rows.filter(r => r.k === k).map(r => r.m));
	};

	module.sortedSetIncrBy = async function (key, increment, value) {
		if (!key) {
			return;
		}

		value = helpers.valueToString(value);
		increment = parseFloat(increment);

		return module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'zset');
			const params = { key, value, increment };
			db.prepare(`
			INSERT INTO "legacy_zset" ("_key", "value", "score")
			VALUES (@key, @value, @increment)
			ON CONFLICT ("_key", "value")
			DO UPDATE SET "score" = "legacy_zset"."score" + @increment		
			`).run(params);
			const res = db.prepare(`
			SELECT "score" s
			FROM "legacy_zset"
			WHERE "_key" = @key
				AND "value" = @value`).get(params);
			return res.s;
		});
	};

	module.sortedSetIncrByBulk = async function (data) {
		// TODO: perf single query?
		return await Promise.all(data.map(item => module.sortedSetIncrBy(item[0], item[1], item[2])));
	};

	module.getSortedSetRangeByLex = async function (key, min, max, start, count) {
		return await sortedSetLex(key, min, max, 1, start, count);
	};

	module.getSortedSetRevRangeByLex = async function (key, max, min, start, count) {
		return await sortedSetLex(key, min, max, -1, start, count);
	};

	module.sortedSetLexCount = async function (key, min, max) {
		const q = buildLexQuery(key, min, max);

		const res = module.db.prepare(`
		SELECT COUNT(*) c
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE ${q.where}`).get(q.params);

		return res.c;
	};

	async function sortedSetLex(key, min, max, sort, start, count) {
		start = start !== undefined ? start : 0;
		count = count !== undefined ? count : -1;

		const q = buildLexQuery(key, min, max);
		q.params.start = start;
		q.params.count = count;
		const rows = module.db.prepare(`
		SELECT z."value" v
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE ${q.where}
		ORDER BY z."value" ${sort > 0 ? 'ASC' : 'DESC'}
		LIMIT @count
		OFFSET @start`).all(q.params);

		return rows.map(r => r.v);
	}

	module.sortedSetRemoveRangeByLex = async function (key, min, max) {
		const q = buildLexQuery(key, min, max);
		const res = module.db.prepare(`
		DELETE FROM "legacy_zset" AS z
		WHERE EXISTS (
			SELECT * FROM "legacy_object_live" o
			WHERE o."_key" = z."_key"
			AND o."type" = z."type"
			AND ${q.where}
		)`).run(q.params);
	};

	function buildLexQuery(key, min, max) {
		const q = {
			where: `o."_key" = @key`,
			params: {key},
		};

		if (min !== '-') {
			if (min.match(/^\(/)) {
				q.params.min = min.slice(1);
				q.where += ` AND z."value" > @min`;
			} else if (min.match(/^\[/)) {
				q.params.min = min.slice(1);
				q.where += ` AND z."value" >= @min`;
			} else {
				q.params.min = min;
				q.where += ` AND z."value" >= @min`;
			}
		}

		if (max !== '+') {
			if (max.match(/^\(/)) {
				q.params.max = max.slice(1);
				q.where += ` AND z."value" < @max`;
			} else if (max.match(/^\[/)) {
				q.params.max = max.slice(1);
				q.where += ` AND z."value" <= @max`;
			} else {
				q.params.max = max;
				q.where += ` AND z."value" <= @max`;
			}
		}

		return q;
	}

	module.getSortedSetScan = async function (options) {
		let { match, key, limit, withScores } = options;
		if (match.startsWith('*')) {
			match = `%${match.substring(1)}`;
		}

		if (match.endsWith('*')) {
			match = `${match.substring(0, match.length - 1)}%`;
		}

		if (!(limit >= 0)) {
			limit = -1;
		}

		const params = { key, limit };
		const rows = module.db.prepare(`
		SELECT z."value",
					 z."score"
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" = @key
			AND z."value" LIKE '${match}'
		LIMIT @limit`).all(params);

		return !withScores ? rows.map(r => r.value) : rows;
	};

	module.processSortedSet = async function (setKey, process, options) {
		const db = connection.connect(nconf.get('sqlite3'));
		const batchSize = (options || {}).batch || 100;
		const params = { key: setKey };
		const iterator = db.prepare(`
		SELECT z."value", 
		       z."score"
		FROM "legacy_object_live" o
		INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
		WHERE o."_key" = @key
		ORDER BY z."score" ASC, z."value" ASC`).iterate(params);

		if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
			process = util.promisify(process);
		}

		for (;;) {
			/* eslint-disable no-await-in-loop */
			let rows = [];
			for (;;) {
				const res = iterator.next();
				if (res.done || rows.push(res.value) >= batchSize) {
					break;
				}
			}
			if (!rows.length) {
				return;
			}

			if (!options.withScores) {
				rows = rows.map(r => r.value);
			}
			try {
				await process(rows);
			} catch (err) {
				iterator.return();
				throw err;
			}
			if (options.interval) {
				await sleep(options.interval);
			}
		}
	};
};
