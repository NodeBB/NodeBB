'use strict';

module.exports = function (db, module) {
	module.sortedSetIntersectCard = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, 0);
		}

		db.query({
			name: 'sortedSetIntersectCard',
			text: `
WITH A AS (SELECT z."value" v,
                  COUNT(*) c
             FROM "legacy_object_live" o
            INNER JOIN "legacy_zset" z
                    ON o."_key" = z."_key"
                   AND o."type" = z."type"
            WHERE o."_key" = ANY($1::TEXT[])
            GROUP BY z."value")
SELECT COUNT(*) c
  FROM A
 WHERE A.c = array_length($1::TEXT[], 1)`,
			values: [keys],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, parseInt(res.rows[0].c, 10));
		});
	};


	module.getSortedSetIntersect = function (params, callback) {
		params.sort = 1;
		getSortedSetIntersect(params, callback);
	};

	module.getSortedSetRevIntersect = function (params, callback) {
		params.sort = -1;
		getSortedSetIntersect(params, callback);
	};

	function getSortedSetIntersect(params, callback) {
		var sets = params.sets;
		var start = params.hasOwnProperty('start') ? params.start : 0;
		var stop = params.hasOwnProperty('stop') ? params.stop : -1;
		var weights = params.weights || [];
		var aggregate = params.aggregate || 'SUM';

		if (sets.length < weights.length) {
			weights = weights.slice(0, sets.length);
		}
		while (sets.length > weights.length) {
			weights.push(1);
		}

		var limit = stop - start + 1;
		if (limit <= 0) {
			limit = null;
		}

		db.query({
			name: 'getSortedSetIntersect' + aggregate + (params.sort > 0 ? 'Asc' : 'Desc') + 'WithScores',
			text: `
WITH A AS (SELECT z."value",
                  ` + aggregate + `(z."score" * k."weight") "score",
                  COUNT(*) c
             FROM UNNEST($1::TEXT[], $2::NUMERIC[]) k("_key", "weight")
            INNER JOIN "legacy_object_live" o
                    ON o."_key" = k."_key"
            INNER JOIN "legacy_zset" z
                    ON o."_key" = z."_key"
                   AND o."type" = z."type"
            GROUP BY z."value")
SELECT A."value",
       A."score"
  FROM A
 WHERE c = array_length($1::TEXT[], 1)
 ORDER BY A."score" ` + (params.sort > 0 ? 'ASC' : 'DESC') + `
 LIMIT $4::INTEGER
OFFSET $3::INTEGER`,
			values: [sets, weights, start, limit],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (params.withScores) {
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
};
