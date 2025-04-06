'use strict';

/**
 * @typedef {import('../../../../types/database').MySQLDatabase} MySQLDatabase
 */

/**
 * 
 * @param {MySQLDatabase} module 
 */
module.exports = function (module) {
    module.sortedSetIntersectCard = async function (keys) {
        if (!Array.isArray(keys) || !keys.length) {
            return 0;
        }

        const [rows] = await module.pool.query({
            sql: `
                WITH A AS (
                    SELECT z.value AS v,
                           COUNT(*) AS c
                    FROM legacy_object_live o
                    INNER JOIN legacy_zset z
                        ON o._key = z._key
                        AND o.type = z.type
                    WHERE o._key IN (${keys.map(() => '?').join(', ')})
                    GROUP BY z.value
                )
                SELECT COUNT(*) AS c
                FROM A
                WHERE A.c = ?
            `,
            values: [...keys, keys.length],
        });

        return parseInt(rows[0].c, 10);
    };

    module.getSortedSetIntersect = async function (params) {
        params.sort = 1;
        return await getSortedSetIntersect(params);
    };

    module.getSortedSetRevIntersect = async function (params) {
        params.sort = -1;
        return await getSortedSetIntersect(params);
    };

    async function getSortedSetIntersect(params) {
        const { sets } = params;
        const start = params.hasOwnProperty('start') ? params.start : 0;
        const stop = params.hasOwnProperty('stop') ? params.stop : -1;
        let weights = params.weights || [];
        const aggregate = params.aggregate || 'SUM';

        if (sets.length < weights.length) {
            weights = weights.slice(0, sets.length);
        }
        while (sets.length > weights.length) {
            weights.push(1);
        }

        let limit = stop - start + 1;
        if (limit <= 0) {
            limit = null;
        }

        // Build weighted score expression
        const weightCases = weights.map((w, i) => 
            `WHEN o._key = ? THEN z.score * ${w}`
        ).join(' ');
        const values = [
            ...sets,           // For IN clause
            ...sets,           // For CASE in aggregate
            ...weights,        // For CASE values (not directly used in query, but kept for consistency)
            sets.length,       // For c = sets.length
            limit,             // LIMIT
            start              // OFFSET
        ].filter(v => v !== null); // Remove null limit if present

        const [rows] = await module.pool.query({
            sql: `
                WITH A AS (
                    SELECT z.value,
                           ${aggregate}(
                               CASE 
                                   ${weightCases}
                                   ELSE z.score
                               END
                           ) AS score,
                           COUNT(*) AS c
                    FROM legacy_object_live o
                    INNER JOIN legacy_zset z
                        ON o._key = z._key
                        AND o.type = z.type
                    WHERE o._key IN (${sets.map(() => '?').join(', ')})
                    GROUP BY z.value
                )
                SELECT A.value,
                       A.score
                FROM A
                WHERE c = ?
                ORDER BY A.score ${params.sort > 0 ? 'ASC' : 'DESC'}
                ${limit !== null ? 'LIMIT ? OFFSET ?' : ''}
            `,
            values,
        });

        if (params.withScores) {
            return rows.map(r => ({
                value: r.value,
                score: parseFloat(r.score),
            }));
        }
        return rows.map(r => r.value);
    }
};