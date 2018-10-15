'use strict';

var async = require('async');

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	var query = db.query.bind(db);

	require('./sorted/add')(db, module);
	require('./sorted/remove')(db, module);
	require('./sorted/union')(db, module);
	require('./sorted/intersect')(db, module);

	module.getSortedSetRange = function (key, start, stop, callback) {
		getSortedSetRange(key, start, stop, 1, false, callback);
	};

	module.getSortedSetRevRange = function (key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, false, callback);
	};

	module.getSortedSetRangeWithScores = function (key, start, stop, callback) {
		getSortedSetRange(key, start, stop, 1, true, callback);
	};

	module.getSortedSetRevRangeWithScores = function (key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, true, callback);
	};

	function getSortedSetRange(key, start, stop, sort, withScores, callback) {
		if (!key) {
			return callback();
		}

		if (!Array.isArray(key)) {
			key = [key];
		}

		if (start < 0 && start > stop) {
			return callback(null, []);
		}

		var reverse = false;
		if (start === 0 && stop < -1) {
			reverse = true;
			sort *= -1;
			start = Math.abs(stop + 1);
			stop = -1;
		} else if (start < 0 && stop > start) {
			var tmp1 = Math.abs(stop + 1);
			stop = Math.abs(start + 1);
			start = tmp1;
		}

		var limit = stop - start + 1;
		if (limit <= 0) {
			limit = null;
		}

		query({
			name: 'getSortedSetRangeWithScores' + (sort > 0 ? 'Asc' : 'Desc'),
			text: `
SELECT z."value",
       z."score"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = ANY($1::TEXT[])
 ORDER BY z."score" ` + (sort > 0 ? 'ASC' : 'DESC') + `
 LIMIT $3::INTEGER
OFFSET $2::INTEGER`,
			values: [key, start, limit],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (reverse) {
				res.rows.reverse();
			}

			if (withScores) {
				res.rows = res.rows.map(function (r) {
					return {
						value: r.value,
						score: parseFloat(r.score),
					};
				});
			} else {
				res.rows = res.rows.map(function (r) {
					return r.value;
				});
			}

			callback(null, res.rows);
		});
	}

	module.getSortedSetRangeByScore = function (key, start, count, min, max, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, 1, false, callback);
	};

	module.getSortedSetRevRangeByScore = function (key, start, count, max, min, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, -1, false, callback);
	};

	module.getSortedSetRangeByScoreWithScores = function (key, start, count, min, max, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, 1, true, callback);
	};

	module.getSortedSetRevRangeByScoreWithScores = function (key, start, count, max, min, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, -1, true, callback);
	};

	function getSortedSetRangeByScore(key, start, count, min, max, sort, withScores, callback) {
		if (!key) {
			return callback();
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

		query({
			name: 'getSortedSetRangeByScoreWithScores' + (sort > 0 ? 'Asc' : 'Desc'),
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
 ORDER BY z."score" ` + (sort > 0 ? 'ASC' : 'DESC') + `
 LIMIT $3::INTEGER
OFFSET $2::INTEGER`,
			values: [key, start, count, min, max],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (withScores) {
				res.rows = res.rows.map(function (r) {
					return {
						value: r.value,
						score: parseFloat(r.score),
					};
				});
			} else {
				res.rows = res.rows.map(function (r) {
					return r.value;
				});
			}

			return callback(null, res.rows);
		});
	}

	module.sortedSetCount = function (key, min, max, callback) {
		if (!key) {
			return callback();
		}

		if (min === '-inf') {
			min = null;
		}
		if (max === '+inf') {
			max = null;
		}

		query({
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
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, parseInt(res.rows[0].c, 10));
		});
	};

	module.sortedSetCard = function (key, callback) {
		if (!key) {
			return callback(null, 0);
		}

		query({
			name: 'sortedSetCard',
			text: `
SELECT COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, parseInt(res.rows[0].c, 10));
		});
	};

	module.sortedSetsCard = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		query({
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
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, keys.map(function (k) {
				return parseInt((res.rows.find(function (r) {
					return r.k === k;
				}) || { c: 0 }).c, 10);
			}));
		});
	};

	module.sortedSetRank = function (key, value, callback) {
		getSortedSetRank('ASC', [key], [value], function (err, result) {
			callback(err, result ? result[0] : null);
		});
	};

	module.sortedSetRevRank = function (key, value, callback) {
		getSortedSetRank('DESC', [key], [value], function (err, result) {
			callback(err, result ? result[0] : null);
		});
	};

	function getSortedSetRank(sort, keys, values, callback) {
		values = values.map(helpers.valueToString);
		query({
			name: 'getSortedSetRank' + sort,
			text: `
SELECT (SELECT r
          FROM (SELECT z."value" v,
                       RANK() OVER (PARTITION BY o."_key"
                                        ORDER BY z."score" ` + sort + `,
                                                 z."value" ` + sort + `) - 1 r
                  FROM "legacy_object_live" o
                 INNER JOIN "legacy_zset" z
                         ON o."_key" = z."_key"
                        AND o."type" = z."type"
                 WHERE o."_key" = kvi.k) r
         WHERE v = kvi.v) r
  FROM UNNEST($1::TEXT[], $2::TEXT[]) WITH ORDINALITY kvi(k, v, i)
 ORDER BY kvi.i ASC`,
			values: [keys, values],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (r) { return r.r === null ? null : parseFloat(r.r); }));
		});
	}

	module.sortedSetsRanks = function (keys, values, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}

		getSortedSetRank('ASC', keys, values, callback);
	};

	module.sortedSetRanks = function (key, values, callback) {
		if (!Array.isArray(values) || !values.length) {
			return callback(null, []);
		}

		getSortedSetRank('ASC', new Array(values.length).fill(key), values, callback);
	};

	module.sortedSetScore = function (key, value, callback) {
		if (!key) {
			return callback(null, null);
		}

		value = helpers.valueToString(value);

		query({
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
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, parseFloat(res.rows[0].s));
			}

			callback(null, null);
		});
	};

	module.sortedSetsScore = function (keys, value, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		value = helpers.valueToString(value);

		query({
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
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, keys.map(function (k) {
				var s = res.rows.find(function (r) {
					return r.k === k;
				});

				return s ? parseFloat(s.s) : null;
			}));
		});
	};

	module.sortedSetScores = function (key, values, callback) {
		if (!key) {
			return callback(null, null);
		}

		values = values.map(helpers.valueToString);

		query({
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
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, values.map(function (v) {
				var s = res.rows.find(function (r) {
					return r.v === v;
				});

				return s ? parseFloat(s.s) : null;
			}));
		});
	};

	module.isSortedSetMember = function (key, value, callback) {
		if (!key) {
			return callback();
		}

		value = helpers.valueToString(value);

		query({
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
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, !!res.rows.length);
		});
	};

	module.isSortedSetMembers = function (key, values, callback) {
		if (!key) {
			return callback();
		}

		values = values.map(helpers.valueToString);

		query({
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
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, values.map(function (v) {
				return res.rows.some(function (r) {
					return r.v === v;
				});
			}));
		});
	};

	module.isMemberOfSortedSets = function (keys, value, callback) {
		if (!Array.isArray(keys)) {
			return callback();
		}

		value = helpers.valueToString(value);

		query({
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
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, keys.map(function (k) {
				return res.rows.some(function (r) {
					return r.k === k;
				});
			}));
		});
	};

	module.getSortedSetsMembers = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}

		query({
			name: 'getSortedSetsMembers',
			text: `
SELECT o."_key" k,
       array_agg(z."value" ORDER BY z."score" ASC) m
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = ANY($1::TEXT[])
 GROUP BY o."_key"`,
			values: [keys],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, keys.map(function (k) {
				return (res.rows.find(function (r) {
					return r.k === k;
				}) || { m: [] }).m;
			}));
		});
	};

	module.sortedSetIncrBy = function (key, increment, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		value = helpers.valueToString(value);
		increment = parseFloat(increment);

		module.transaction(function (tx, done) {
			async.waterfall([
				async.apply(helpers.ensureLegacyObjectType, tx.client, key, 'zset'),
				async.apply(tx.client.query.bind(tx.client), {
					name: 'sortedSetIncrBy',
					text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
VALUES ($1::TEXT, $2::TEXT, $3::NUMERIC)
    ON CONFLICT ("_key", "value")
    DO UPDATE SET "score" = "legacy_zset"."score" + $3::NUMERIC
RETURNING "score" s`,
					values: [key, value, increment],
				}),
				function (res, next) {
					next(null, parseFloat(res.rows[0].s));
				},
			], done);
		}, callback);
	};

	module.getSortedSetRangeByLex = function (key, min, max, start, count, callback) {
		sortedSetLex(key, min, max, 1, start, count, callback);
	};

	module.getSortedSetRevRangeByLex = function (key, max, min, start, count, callback) {
		sortedSetLex(key, min, max, -1, start, count, callback);
	};

	module.sortedSetLexCount = function (key, min, max, callback) {
		var q = buildLexQuery(key, min, max);

		query({
			name: 'sortedSetLexCount' + q.suffix,
			text: `
SELECT COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE ` + q.where,
			values: q.values,
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, parseInt(res.rows[0].c, 10));
		});
	};

	function sortedSetLex(key, min, max, sort, start, count, callback) {
		if (!callback) {
			callback = start;
			start = 0;
			count = 0;
		}

		var q = buildLexQuery(key, min, max);
		q.values.push(start);
		q.values.push(count <= 0 ? null : count);
		query({
			name: 'sortedSetLex' + (sort > 0 ? 'Asc' : 'Desc') + q.suffix,
			text: `
SELECT z."value" v
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE ` + q.where + `
 ORDER BY z."value" ` + (sort > 0 ? 'ASC' : 'DESC') + `
 LIMIT $` + q.values.length + `::INTEGER
OFFSET $` + (q.values.length - 1) + `::INTEGER`,
			values: q.values,
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (r) {
				return r.v;
			}));
		});
	}

	module.sortedSetRemoveRangeByLex = function (key, min, max, callback) {
		callback = callback || helpers.noop;

		var q = buildLexQuery(key, min, max);
		query({
			name: 'sortedSetRemoveRangeByLex' + q.suffix,
			text: `
DELETE FROM "legacy_zset" z
 USING "legacy_object_live" o
 WHERE o."_key" = z."_key"
   AND o."type" = z."type"
   AND ` + q.where,
			values: q.values,
		}, function (err) {
			callback(err);
		});
	};

	function buildLexQuery(key, min, max) {
		var q = {
			suffix: '',
			where: `o."_key" = $1::TEXT`,
			values: [key],
		};

		if (min !== '-') {
			if (min.match(/^\(/)) {
				q.values.push(min.substr(1));
				q.suffix += 'GT';
				q.where += ` AND z."value" > $` + q.values.length + `::TEXT`;
			} else if (min.match(/^\[/)) {
				q.values.push(min.substr(1));
				q.suffix += 'GE';
				q.where += ` AND z."value" >= $` + q.values.length + `::TEXT`;
			} else {
				q.values.push(min);
				q.suffix += 'GE';
				q.where += ` AND z."value" >= $` + q.values.length + `::TEXT`;
			}
		}

		if (max !== '+') {
			if (max.match(/^\(/)) {
				q.values.push(max.substr(1));
				q.suffix += 'LT';
				q.where += ` AND z."value" < $` + q.values.length + `::TEXT`;
			} else if (max.match(/^\[/)) {
				q.values.push(max.substr(1));
				q.suffix += 'LE';
				q.where += ` AND z."value" <= $` + q.values.length + `::TEXT`;
			} else {
				q.values.push(max);
				q.suffix += 'LE';
				q.where += ` AND z."value" <= $` + q.values.length + `::TEXT`;
			}
		}

		return q;
	}

	module.processSortedSet = function (setKey, process, options, callback) {
		var Cursor = require('pg-cursor');

		db.connect(function (err, client, done) {
			if (err) {
				return callback(err);
			}

			var batchSize = (options || {}).batch || 100;
			var query = client.query(new Cursor(`
SELECT z."value", z."score"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = $1::TEXT
 ORDER BY z."score" ASC, z."value" ASC`, [setKey]));

			async.doUntil(function (next) {
				query.read(batchSize, function (err, rows) {
					if (err) {
						return next(err);
					}

					if (!rows.length) {
						return next(null, true);
					}

					rows = rows.map(function (row) {
						return options.withScores ? row : row.value;
					});

					process(rows, function (err) {
						if (err) {
							return query.close(function () {
								next(err);
							});
						}

						if (options.interval) {
							setTimeout(next, options.interval);
						} else {
							next();
						}
					});
				});
			}, function (stop) {
				return stop;
			}, function (err) {
				done();
				callback(err);
			});
		});
	};
};
