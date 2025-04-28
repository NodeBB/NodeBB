'use strict';

/**
 * 
 * @param {import('../../../types/database').MySQLDatabase} module 
 */
module.exports = function (module) {
    const helpers = require('./helpers');
    const util = require('util');
    const sleep = util.promisify(setTimeout);

    // Import previously translated sorted set modules
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

        if (!key.length) {
            return [];
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
            limit = Number.MAX_SAFE_INTEGER;
        }

        const [rows] = await module.pool.query({
            sql: `
                SELECT z.value,
                       z.score
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key IN (?)
                ORDER BY z.score ${sort > 0 ? 'ASC' : 'DESC'}
                LIMIT ? OFFSET ?
            `,
            values: [key, limit, start],
        });

        let result = rows;
        if (reverse) {
            result = result.reverse();
        }

        if (withScores) {
            result = result.map(r => ({ value: r.value, score: parseFloat(r.score) }));
        } else {
            result = result.map(r => r.value);
        }

        return result;
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

        const conditions = [];
        const values = [...key];
        if (min !== null) {
            conditions.push('z.score >= ?');
            values.push(min);
        }
        if (max !== null) {
            conditions.push('z.score <= ?');
            values.push(max);
        }
        if (count !== null) {
            values.push(count);
        } else {
            values.push(Number.MAX_SAFE_INTEGER)
        }
        values.push(start);
        const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

        const [rows] = await module.pool.query({
            sql: `
                SELECT z.value,
                       z.score
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key IN (${key.map(() => '?').join(', ')})
                ${whereClause}
                ORDER BY z.score ${sort > 0 ? 'ASC' : 'DESC'}
                LIMIT ? OFFSET ?
            `,
            values,
        });

        if (withScores) {
            return rows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
        }
        return rows.map(r => r.value);
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

        const conditions = [];
        const values = [key];
        if (min !== null) {
            conditions.push('z.score >= ?');
            values.push(min);
        }
        if (max !== null) {
            conditions.push('z.score <= ?');
            values.push(max);
        }
        const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

        const [rows] = await module.pool.query({
            sql: `
                SELECT COUNT(*) AS c
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key = ?
                ${whereClause}
            `,
            values,
        });

        return parseInt(rows[0].c, 10);
    };

    module.sortedSetCard = async function (key) {
        if (!key) {
            return 0;
        }

        const [rows] = await module.pool.query({
            sql: `
                SELECT COUNT(*) AS c
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key = ?
            `,
            values: [key],
        });

        return parseInt(rows[0].c, 10);
    };

    module.sortedSetsCard = async function (keys) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }

        const [rows] = await module.pool.query({
            sql: `
                SELECT o._key AS k,
                       COUNT(*) AS c
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key IN (${keys.map(() => '?').join(', ')})
                GROUP BY o._key
            `,
            values: keys,
        });

        return keys.map(k => parseInt((rows.find(r => r.k === k) || { c: 0 }).c, 10));
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

            const conditions = [];
            const values = [keys];
            if (min !== null) {
                conditions.push('z.score >= ?');
                values.push(min);
            }
            if (max !== null) {
                conditions.push('z.score <= ?');
                values.push(max);
            }
            const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

            const [rows] = await module.pool.query({
                sql: `
                    SELECT o._key AS k,
                           COUNT(*) AS c
                    FROM legacy_object_live o
                    INNER JOIN legacy_zset z
                        ON o._key = z._key
                        AND o.type = z.type
                    WHERE o._key IN (?)
                    ${whereClause}
                    GROUP BY o._key
                `,
                values,
            });
            counts = keys.map(k => parseInt((rows.find(r => r.k === k) || { c: 0 }).c, 10));
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
        values = values.map(String);
        const keyPlaceholders = keys.map(() => '?').join(', ');
        // Generate UNION ALL for each key-value pair with index
        const pairUnions = keys.map((_, i) => `SELECT ${i} AS i, ? AS k, ? AS v`).join(' UNION ALL ');
        const indexedValues = [];
        for (let i = 0; i < keys.length; i++) {
            indexedValues.push(keys[i], values[i]); // Key, value
        }

        try {
            const [rows] = await module.pool.query({
                sql: `
                    WITH Ranked AS (
                        SELECT o._key AS k,
                               z.value AS v,
                               ROW_NUMBER() OVER (PARTITION BY o._key ORDER BY z.score ${sort}, z.value ${sort}) - 1 AS r
                        FROM legacy_object_live o
                        INNER JOIN legacy_zset z
                            ON o._key = z._key
                            AND o.type = z.type
                        WHERE o._key IN (${keyPlaceholders})
                    ),
                    InputPairs AS (
                        ${pairUnions}
                    )
                    SELECT r.r
                    FROM InputPairs ip
                    LEFT JOIN Ranked r
                        ON r.k = ip.k AND r.v = ip.v
                    ORDER BY ip.i ASC
                `,
                values: [...keys, ...indexedValues]
            });
            return rows.map(row => (row.r === null ? null : parseFloat(row.r)));
        } catch (err) {
            console.error('SQL Error:', err);
            throw err;
        }
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

        const [rows] = await module.pool.query({
            sql: `
                SELECT z.score AS s
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key = ?
                  AND z.value = ?
            `,
            values: [key, value],
        });
        if (rows.length) {
            return parseFloat(rows[0].s);
        }
        return null;
    };

    module.sortedSetsScore = async function (keys, value) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }

        value = helpers.valueToString(value);

        const [rows] = await module.pool.query({
            sql: `
                SELECT o._key AS k,
                       z.score AS s
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key IN (${keys.map(() => '?').join(', ')})
                  AND z.value = ?
            `,
            values: [...keys, value],
        });

        return keys.map((k) => {
            const s = rows.find(r => r.k === k);
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

        const [rows] = await module.pool.query({
            sql: `
                SELECT z.value AS v,
                       z.score AS s
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key = ?
                  AND z.value IN (${values.map(() => '?').join(', ')})
            `,
            values: [key, ...values],
        });

        return values.map((v) => {
            const s = rows.find(r => r.v === v);
            return s ? parseFloat(s.s) : null;
        });
    };

    module.isSortedSetMember = async function (key, value) {
        if (!key) {
            return;
        }

        value = helpers.valueToString(value);

        const [rows] = await module.pool.query({
            sql: `
                SELECT 1
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key = ?
                  AND z.value = ?
            `,
            values: [key, value],
        });

        return !!rows.length;
    };

    module.isSortedSetMembers = async function (key, values) {
        if (!key) {
            return;
        }

        if (!values.length) {
            return [];
        }
        values = values.map(helpers.valueToString);

        const [rows] = await module.pool.query({
            sql: `
                SELECT z.value AS v
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key = ?
                  AND z.value IN (${values.map(() => '?').join(', ')})
            `,
            values: [key, ...values],
        });

        return values.map(v => rows.some(r => r.v === v));
    };

    module.isMemberOfSortedSets = async function (keys, value) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }

        value = helpers.valueToString(value);

        const [rows] = await module.pool.query({
            sql: `
                SELECT o._key AS k
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key IN (${keys.map(() => '?').join(', ')})
                  AND z.value = ?
            `,
            values: [...keys, value],
        });

        return keys.map(k => rows.some(r => r.k === k));
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

        const [rows] = await module.pool.query({
            sql: `
                SELECT o._key AS k,
                       GROUP_CONCAT(z.value SEPARATOR ',') AS m
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key IN (${keys.map(() => '?').join(', ')})
                GROUP BY o._key
            `,
            values: keys,
        });

        return keys.map(k => (rows.find(r => r.k === k) || { m: '' }).m.split(',').filter(Boolean));
    };

    module.getSortedSetsMembersWithScores = async function (keys) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }

        const [rows] = await module.pool.query({
            sql: `
                SELECT o._key AS k,
                       JSON_ARRAYAGG(
                           JSON_OBJECT('value', z.value, 'score', z.score)
                       ) AS m
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE o._key IN (${keys.map(() => '?').join(', ')})
                GROUP BY o._key
            `,
            values: keys,
        });

        return keys.map(k => {
            const row = rows.find(r => r.k === k);
            return row ? row.m : [];
        });
    };

    module.sortedSetIncrBy = async function (key, increment, value) {
        if (!key) {
            return;
        }

        value = helpers.valueToString(value);
        increment = parseFloat(increment);

        return await module.transaction(async (connection) => {
            await helpers.ensureLegacyObjectType(connection, key, 'zset');
            const [rows] = await connection.query({
                sql: `
                        INSERT INTO legacy_zset (_key, value, score)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            score = legacy_zset.score + VALUES(score)
                    `,
                values: [key, value, increment],
            });
            const [result] = await connection.query({
                sql: `SELECT score FROM legacy_zset WHERE _key = ? AND value = ?`,
                values: [key, value],
            });
            return parseFloat(result[0].score);
        });
    };

    module.sortedSetIncrByBulk = async function (data) {
        if (!data.length) {
            return [];
        }

        return await module.transaction(async (connection) => {
            await helpers.ensureLegacyObjectsType(connection, data.map(item => item[0]), 'zset');

            const placeholders = data.map(() => '(?, ?, ?)').join(', ');
            const flatValues = [];
            data.forEach(([key, increment, value]) => {
                value = helpers.valueToString(value);
                increment = parseFloat(increment);
                flatValues.push(key, value, increment);
            });

            await connection.query({
                sql: `
                    INSERT INTO legacy_zset (_key, value, score)
                    VALUES ${placeholders}
                    ON DUPLICATE KEY UPDATE
                        score = legacy_zset.score + VALUES(score)
                `,
                values: flatValues,
            });

            const resultKeys = data.map(d => d[0]);
            const resultValues = data.map(d => helpers.valueToString(d[2]));
            const [rows] = await connection.query({
                sql: `
                    SELECT score
                    FROM legacy_zset
                    WHERE (_key, value) IN (${data.map(() => '(?, ?)').join(', ')})
                `,
                values: flatValues.filter((_, i) => i % 3 !== 2),
            });

            return rows.map(row => parseFloat(row.score));
        });
    };

    module.getSortedSetRangeByLex = async function (key, min, max, start, count) {
        return await sortedSetLex(key, min, max, 1, start, count);
    };

    module.getSortedSetRevRangeByLex = async function (key, max, min, start, count) {
        return await sortedSetLex(key, min, max, -1, start, count);
    };

    module.sortedSetLexCount = async function (key, min, max) {
        const q = buildLexQuery(key, min, max);

        const [rows] = await module.pool.query({
            sql: `
                SELECT COUNT(*) AS c
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE ${q.where}
            `,
            values: q.values,
        });

        return parseInt(rows[0].c, 10);
    };

    async function sortedSetLex(key, min, max, sort, start, count) {
        start = start !== undefined ? start : 0;
        count = count !== undefined ? count : 0;

        const q = buildLexQuery(key, min, max);
        q.values.push(count <= 0 ? null : count);
        q.values.push(start);

        const [rows] = await module.pool.query({
            sql: `
                SELECT z.value AS v
                FROM legacy_object_live o
                INNER JOIN legacy_zset z
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE ${q.where}
                ORDER BY z.value ${sort > 0 ? 'ASC' : 'DESC'}
                ${count > 0 ? 'LIMIT ? OFFSET ?' : ''}
            `,
            values: q.values,
        });

        return rows.map(r => r.v);
    }

    module.sortedSetRemoveRangeByLex = async function (key, min, max) {
        const q = buildLexQuery(key, min, max);
        await module.pool.query({
            sql: `
                DELETE z
                FROM legacy_zset z
                INNER JOIN legacy_object_live o
                    ON o._key = z._key
                    AND o.type = z.type
                WHERE ${q.where}
            `,
            values: q.values,
        });
    };

    function buildLexQuery(key, min, max) {
        const q = {
            suffix: '',
            where: `o._key = ?`,
            values: [key],
        };

        if (min !== '-') {
            if (min.match(/^\(/)) {
                q.values.push(min.slice(1));
                q.suffix += 'GT';
                q.where += ` AND z.value > BINARY ?`;
            } else if (min.match(/^\[/)) {
                q.values.push(min.slice(1));
                q.suffix += 'GE';
                q.where += ` AND z.value >= BINARY ?`;
            } else {
                q.values.push(min);
                q.suffix += 'GE';
                q.where += ` AND z.value >= BINARY ?`;
            }
        }

        if (max !== '+') {
            if (max.match(/^\(/)) {
                q.values.push(max.slice(1));
                q.suffix += 'LT';
                q.where += ` AND z.value < BINARY ?`;
            } else if (max.match(/^\[/)) {
                q.values.push(max.slice(1));
                q.suffix += 'LE';
                q.where += ` AND z.value <= BINARY ?`;
            } else {
                q.values.push(max);
                q.suffix += 'LE';
                q.where += ` AND z.value <= BINARY ?`;
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

        // Prepare the SQL query, conditionally adding LIMIT if params.limit is defined
        let sql = `
            SELECT z.value,
                z.score
            FROM legacy_object_live o
            INNER JOIN legacy_zset z
                ON o._key = z._key
                AND o.type = z.type
            WHERE o._key = ?
            AND z.value LIKE ?
        `;
        const values = [params.key, match];

        if (params.limit !== undefined && params.limit !== null) {
            sql += ` LIMIT ?`;
            values.push(parseInt(params.limit, 10));
        }

        const [rows] = await module.pool.query({
            sql,
            values,
        });
        if (!params.withScores) {
            return rows.map(r => r.value);
        }
        return rows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
    };

    module.processSortedSet = async function (setKey, process, options) {
        const connection = await module.pool.getConnection();
        try {
            const batchSize = (options || {}).batch || 100;
            const sort = options.reverse ? 'DESC' : 'ASC';
            const min = options.min && options.min !== '-inf' ? options.min : null;
            const max = options.max && options.max !== '+inf' ? options.max : null;

            const conditions = [];
            const values = [setKey];
            if (min !== null) {
                conditions.push('z.score >= ?');
                values.push(min);
            }
            if (max !== null) {
                conditions.push('z.score <= ?');
                values.push(max);
            }
            const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

            if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
                process = util.promisify(process);
            }

            let offset = 0;
            let iteration = 1;
            while (true) {
                const [rows] = await connection.query({
                    sql: `
                        SELECT z.value, z.score
                        FROM legacy_object_live o
                        INNER JOIN legacy_zset z
                            ON o._key = z._key
                            AND o.type = z.type
                        WHERE o._key = ?
                        ${whereClause}
                        ORDER BY z.score ${sort}, z.value ${sort}
                        LIMIT ? OFFSET ?
                    `,
                    values: [...values, batchSize, offset],
                });

                if (!rows.length) {
                    break;
                }

                let processedRows = rows;
                if (options.withScores) {
                    processedRows = processedRows.map(r => ({ value: r.value, score: parseFloat(r.score) }));
                } else {
                    processedRows = processedRows.map(r => r.value);
                }

                try {
                    if (iteration > 1 && options.interval) {
                        await sleep(options.interval);
                    }
                    await process(processedRows);
                    iteration += 1;
                    offset += batchSize;
                } catch (err) {
                    throw err;
                }
            }
        } finally {
            connection.release();
        }
    };
};