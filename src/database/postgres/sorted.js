'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');
	const util = require('util');
	const Cursor = require('pg-cursor');
	Cursor.prototype.readAsync = util.promisify(Cursor.prototype.read);
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

		if (!Array.isArray(key)) {
			key = [key];
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
			limit = null;
		}

		const res = await module.pool.query({
			name: `getSortedSetRangeWithScores${sort > 0 ? 'Asc' : 'Desc'}`,
			text: `
SELECT z."value",
       z."score"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = ANY($1::TEXT[])
 ORDER BY z."score" ${sort > 0 ? 'ASC' : 'DESC'}
 LIMIT $3::INTEGER
OFFSET $2::INTEGER`,
			values: [key, start, limit],
		});

		if (reverse) {
			res.rows.reverse();
		}

		if (withScores) {
			res.rows = res.rows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
		} else {
			res.rows = res.rows.map(r => r.value);
		}

		return res.rows;
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

		if (!Array.isArray(key)) {
			key = [key];
		}

		if (parseInt(count, 10) === -1) {
			count = null;
		}

		if (min === '-inf') {
			min = null;
		}
		if (max === '+inf') {
			max = null;
		}

		const res = await module.pool.query({
			name: `getSortedSetRangeByScoreWithScores${sort > 0 ? 'Asc' : 'Desc'}`,
			text: `
SELECT z."value",
       z."score"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = ANY($1::TEXT[])
   AND (z."score" >= $4::NUMERIC OR $4::NUMERIC IS NULL)
   AND (z."score" <= $5::NUMERIC OR $5::NUMERIC IS NULL)
 ORDER BY z."score" ${sort > 0 ? 'ASC' : 'DESC'}
 LIMIT $3::INTEGER
OFFSET $2::INTEGER`,
			values: [key, start, count, min, max],
		});

		if (withScores) {
			res.rows = res.rows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
		} else {
			res.rows = res.rows.map(r => r.value);
		}

		return res.rows;
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

		const res = await module.pool.query({
			name: 'sortedSetCount',
			text: `
SELECT COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT
   AND (z."score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
   AND (z."score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)`,
			values: [key, min, max],
		});

		return parseInt(res.rows[0].c, 10);
	};

	module.sortedSetCard = async function (key) {
		if (!key) {
			return 0;
		}

		const res = await module.pool.query({
			name: 'sortedSetCard',
			text: `
SELECT COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT`,
			values: [key],
		});

		return parseInt(res.rows[0].c, 10);
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const res = await module.pool.query({
			name: 'sortedSetsCard',
			text: `
SELECT o."_key" k,
       COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = ANY($1::TEXT[])
 GROUP BY o."_key"`,
			values: [keys],
		});

		return keys.map(k => parseInt((res.rows.find(r => r.k === k) || { c: 0 }).c, 10));
	};

	module.sortedSetsCardSum = async function (keys, min = '-inf', max = '+inf') {
		if (!keys || (Array.isArray(keys) && !keys.length)) {
			return 0;
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		let counts = [];
		if (min !== '-inf' || max !== '+inf') {
			if (min === '-inf') {
				min = null;
			}
			if (max === '+inf') {
				max = null;
			}

			const res = await module.pool.query({
				name: 'sortedSetsCardSum',
				text: `
	SELECT o."_key" k,
		COUNT(*) c
	FROM "legacy_object_live" o
	INNER JOIN "legacy_zset" z
			 ON o."_key" = z."_key"
			AND o."type" = z."type"
	WHERE o."_key" = ANY($1::TEXT[])
		AND (z."score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
		AND (z."score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)
	GROUP BY o."_key"`,
				values: [keys, min, max],
			});
			counts = keys.map(k => parseInt((res.rows.find(r => r.k === k) || { c: 0 }).c, 10));
		} else {
			counts = await module.sortedSetsCard(keys);
		}
		return counts.reduce((acc, val) => acc + val, 0);
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
		values = values.map(helpers.valueToString);
		const res = await module.pool.query({
			name: `getSortedSetRank${sort}`,
			text: `
SELECT (SELECT r
          FROM (SELECT z."value" v,
                       RANK() OVER (PARTITION BY o."_key"
                                        ORDER BY z."score" ${sort},
                                                 z."value" ${sort}) - 1 r
                  FROM "legacy_object_live" o
                 INNER JOIN "legacy_zset" z
                         ON o."_key" = z."_key"
                        AND o."type" = z."type"
                 WHERE o."_key" = kvi.k) r
         WHERE v = kvi.v) r
  FROM UNNEST($1::TEXT[], $2::TEXT[]) WITH ORDINALITY kvi(k, v, i)
 ORDER BY kvi.i ASC`,
			values: [keys, values],
		});

		return res.rows.map(r => (r.r === null ? null : parseFloat(r.r)));
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

		const res = await module.pool.query({
			name: 'sortedSetScore',
			text: `
SELECT z."score" s
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT
   AND z."value" = $2::TEXT`,
			values: [key, value],
		});
		if (res.rows.length) {
			return parseFloat(res.rows[0].s);
		}
		return null;
	};

	module.sortedSetsScore = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		value = helpers.valueToString(value);

		const res = await module.pool.query({
			name: 'sortedSetsScore',
			text: `
SELECT o."_key" k,
       z."score" s
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = ANY($1::TEXT[])
   AND z."value" = $2::TEXT`,
			values: [keys, value],
		});

		return keys.map((k) => {
			const s = res.rows.find(r => r.k === k);
			return s ? parseFloat(s.s) : null;
		});
	};

	module.sortedSetScores = async function (key, values) {
		if (!key) {
			return null;
		}
		if (!values.length) {
			return [];
		}
		values = values.map(helpers.valueToString);

		const res = await module.pool.query({
			name: 'sortedSetScores',
			text: `
SELECT z."value" v,
       z."score" s
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT
   AND z."value" = ANY($2::TEXT[])`,
			values: [key, values],
		});

		return values.map((v) => {
			const s = res.rows.find(r => r.v === v);
			return s ? parseFloat(s.s) : null;
		});
	};

	module.isSortedSetMember = async function (key, value) {
		if (!key) {
			return;
		}

		value = helpers.valueToString(value);

		const res = await module.pool.query({
			name: 'isSortedSetMember',
			text: `
SELECT 1
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT
   AND z."value" = $2::TEXT`,
			values: [key, value],
		});

		return !!res.rows.length;
	};

	module.isSortedSetMembers = async function (key, values) {
		if (!key) {
			return;
		}

		if (!values.length) {
			return [];
		}
		values = values.map(helpers.valueToString);

		const res = await module.pool.query({
			name: 'isSortedSetMembers',
			text: `
SELECT z."value" v
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT
   AND z."value" = ANY($2::TEXT[])`,
			values: [key, values],
		});

		return values.map(v => res.rows.some(r => r.v === v));
	};

	module.isMemberOfSortedSets = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		value = helpers.valueToString(value);

		const res = await module.pool.query({
			name: 'isMemberOfSortedSets',
			text: `
SELECT o."_key" k
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = ANY($1::TEXT[])
   AND z."value" = $2::TEXT`,
			values: [keys, value],
		});

		return keys.map(k => res.rows.some(r => r.k === k));
	};

	module.getSortedSetMembers = async function (key) {
		const data = await module.getSortedSetsMembers([key]);
		return data && data[0];
	};

	module.getSortedSetMembersWithScores = async function (key) {
		const data = await module.getSortedSetsMembersWithScores([key]);
		return data && data[0];
	};

	module.getSortedSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const res = await module.pool.query({
			name: 'getSortedSetsMembers',
			text: `
SELECT "_key" k,
       "nodebb_get_sorted_set_members"("_key") m
  FROM UNNEST($1::TEXT[]) "_key";`,
			values: [keys],
		});

		return keys.map(k => (res.rows.find(r => r.k === k) || {}).m || []);
	};

	module.getSortedSetsMembersWithScores = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const res = await module.pool.query({
			name: 'getSortedSetsMembersWithScores',
			text: `
SELECT "_key" k,
       "nodebb_get_sorted_set_members_withscores"("_key") m
  FROM UNNEST($1::TEXT[]) "_key";`,
			values: [keys],
		});

		return keys.map(k => (res.rows.find(r => r.k === k) || {}).m || []);
	};

	module.sortedSetIncrBy = async function (key, increment, value) {
		if (!key) {
			return;
		}

		value = helpers.valueToString(value);
		increment = parseFloat(increment);

		return await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'zset');
			const res = await client.query({
				name: 'sortedSetIncrBy',
				text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
VALUES ($1::TEXT, $2::TEXT, $3::NUMERIC)
ON CONFLICT ("_key", "value")
DO UPDATE SET "score" = "legacy_zset"."score" + $3::NUMERIC
RETURNING "score" s`,
				values: [key, value, increment],
			});
			return parseFloat(res.rows[0].s);
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

		const res = await module.pool.query({
			name: `sortedSetLexCount${q.suffix}`,
			text: `
SELECT COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE ${q.where}`,
			values: q.values,
		});

		return parseInt(res.rows[0].c, 10);
	};

	async function sortedSetLex(key, min, max, sort, start, count) {
		start = start !== undefined ? start : 0;
		count = count !== undefined ? count : 0;

		const q = buildLexQuery(key, min, max);
		q.values.push(start);
		q.values.push(count <= 0 ? null : count);
		const res = await module.pool.query({
			name: `sortedSetLex${sort > 0 ? 'Asc' : 'Desc'}${q.suffix}`,
			text: `
SELECT z."value" v
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE ${q.where}
 ORDER BY z."value" ${sort > 0 ? 'ASC' : 'DESC'}
 LIMIT $${q.values.length}::INTEGER
OFFSET $${q.values.length - 1}::INTEGER`,
			values: q.values,
		});

		return res.rows.map(r => r.v);
	}

	module.sortedSetRemoveRangeByLex = async function (key, min, max) {
		const q = buildLexQuery(key, min, max);
		await module.pool.query({
			name: `sortedSetRemoveRangeByLex${q.suffix}`,
			text: `
DELETE FROM "legacy_zset" z
 USING "legacy_object_live" o
 WHERE o."_key" = z."_key"
   AND o."type" = z."type"
   AND ${q.where}`,
			values: q.values,
		});
	};

	function buildLexQuery(key, min, max) {
		const q = {
			suffix: '',
			where: `o."_key" = $1::TEXT`,
			values: [key],
		};

		if (min !== '-') {
			if (min.match(/^\(/)) {
				q.values.push(min.slice(1));
				q.suffix += 'GT';
				q.where += ` AND z."value" > $${q.values.length}::TEXT COLLATE "C"`;
			} else if (min.match(/^\[/)) {
				q.values.push(min.slice(1));
				q.suffix += 'GE';
				q.where += ` AND z."value" >= $${q.values.length}::TEXT COLLATE "C"`;
			} else {
				q.values.push(min);
				q.suffix += 'GE';
				q.where += ` AND z."value" >= $${q.values.length}::TEXT COLLATE "C"`;
			}
		}

		if (max !== '+') {
			if (max.match(/^\(/)) {
				q.values.push(max.slice(1));
				q.suffix += 'LT';
				q.where += ` AND z."value" < $${q.values.length}::TEXT COLLATE "C"`;
			} else if (max.match(/^\[/)) {
				q.values.push(max.slice(1));
				q.suffix += 'LE';
				q.where += ` AND z."value" <= $${q.values.length}::TEXT COLLATE "C"`;
			} else {
				q.values.push(max);
				q.suffix += 'LE';
				q.where += ` AND z."value" <= $${q.values.length}::TEXT COLLATE "C"`;
			}
		}

		return q;
	}

	module.getSortedSetScan = async function (params) {
		let { match } = params;
		if (match.startsWith('*')) {
			match = `%${match.substring(1)}`;
		}

		if (match.endsWith('*')) {
			match = `${match.substring(0, match.length - 1)}%`;
		}

		const res = await module.pool.query({
			text: `
SELECT z."value",
       z."score"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT
  AND z."value" LIKE '${match}'
  LIMIT $2::INTEGER`,
			values: [params.key, params.limit],
		});
		if (!params.withScores) {
			return res.rows.map(r => r.value);
		}
		return res.rows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
	};

	module.processSortedSet = async function (setKey, process, options) {
		const client = await module.pool.connect();
		const batchSize = (options || {}).batch || 100;
		const sort = options.reverse ? 'DESC' : 'ASC';
		const min = options.min && options.min !== '-inf' ? options.min : null;
		const max = options.max && options.max !== '+inf' ? options.max : null;
		const cursor = client.query(new Cursor(`
SELECT z."value", z."score"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT
   AND (z."score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
   AND (z."score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)
 ORDER BY z."score" ${sort}, z."value" ${sort}`, [setKey, min, max]));

		if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
			process = util.promisify(process);
		}
		let iteration = 1;
		while (true) {
			/* eslint-disable no-await-in-loop */
			let rows = await cursor.readAsync(batchSize);
			if (!rows.length) {
				client.release();
				return;
			}

			if (options.withScores) {
				rows = rows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
			} else {
				rows = rows.map(r => r.value);
			}
			try {
				if (iteration > 1 && options.interval) {
					await sleep(options.interval);
				}
				await process(rows);
				iteration += 1;
			} catch (err) {
				await client.release();
				throw err;
			}
		}
	};
};
