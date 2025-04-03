'use strict';

/**
 * @typedef {import('../../../types/database/hash').Hash} Hash
 */

/**
 * @param {Hash & import('../../../types/database').MySQLDatabase} module
 */
module.exports = function (module) {
    const helpers = require('./helpers');

    module.setObject = async function (key, data) {
        if (!key || !data) {
            return;
        }

        if (data.hasOwnProperty('')) {
            delete data[''];
        }
        if (!Object.keys(data).length) {
            return;
        }
        await module.transaction(async (client) => {
            const dataString = JSON.stringify(data);

            if (Array.isArray(key)) {
                await helpers.ensureLegacyObjectsType(client, key, 'hash');
                // For array of keys, we'll need to use a different approach since MySQL doesn't have UNNEST
                await client.query({
                    name: 'setObjectKeys',
                    sql: `
                        INSERT INTO legacy_hash (_key, data)
                        SELECT k, ? AS data
                        FROM JSON_TABLE(
                            ?,
                            '$[*]' COLUMNS (k VARCHAR(255) PATH '$')
                        ) AS jt
                        ON DUPLICATE KEY UPDATE
                            data = JSON_MERGE_PATCH(legacy_hash.data, ?)
                    `,
                    values: [dataString, JSON.stringify(key), dataString],
                });
            } else {
                await helpers.ensureLegacyObjectType(client, key, 'hash');
                await client.query({
                    name: 'setObject',
                    sql: `
                        INSERT INTO legacy_hash (_key, data)
                        VALUES (?, ?)
                        ON DUPLICATE KEY UPDATE
                            data = JSON_MERGE_PATCH(legacy_hash.data, ?)
                    `,
                    values: [key, dataString, dataString],
                });
            }
        });
    };

    module.setObjectBulk = async function (data) {
        if (!Array.isArray(data) || !data.length) {
            return;
        }

        const queries = data.map(([key, obj]) => {
            const fields = Object.keys(obj).map(field => `${field} = ?`).join(', ');
            const values = Object.values(obj);

            return {
                sql: `INSERT INTO hash (_key, ${Object.keys(obj).join(', ')})
                      VALUES (?, ${values.map(() => '?').join(', ')})
                      ON DUPLICATE KEY UPDATE ${fields}`,
                values: [key, ...values, ...values],
            };
        });

        await Promise.all(queries.map(query => module.pool.query(query.sql, query.values)));
    };

    module.setObjectField = async function (key, field, value) {
        if (!key || !field) {
            return;
        }

        await module.pool.query(
            `INSERT INTO hash (_key, ${field})
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE ${field} = ?`,
            [key, value, value]
        );
    };

    module.getObject = async function (key, fields = []) {
        if (!key) {
            return null;
        }

        const res = await module.pool.query({
            name: 'getObject',
            sql: `
                SELECT h.data
                FROM legacy_object_live o
                INNER JOIN legacy_hash h
                        ON o._key = h._key
                        AND o.type = h.type
                WHERE o._key = ?
                LIMIT 1`,
            values: [key],
        });

        return res[0].length ? res[0].data : null;

        const sql = fields.length
            ? `SELECT ${fields.join(', ')} FROM hash WHERE _key = ?`
            : `SELECT * FROM hash WHERE _key = ?`;

        const [rows] = await module.pool.query(sql, [key]);
        return rows.length ? rows[0] : null;
    };

    module.getObjects = async function (keys, fields = []) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }

        const sql = fields.length
            ? `SELECT _key, ${fields.join(', ')} FROM hash WHERE _key IN (?)`
            : `SELECT * FROM hash WHERE _key IN (?)`;

        const [rows] = await module.pool.query(sql, [keys]);
        const result = keys.map(key => rows.find(row => row._key === key) || null);
        return result;
    };

    module.getObjectField = async function (key, field) {
        if (!key || !field) {
            return null;
        }

        const [rows] = await module.pool.query(
            `SELECT ${field} FROM hash WHERE _key = ?`,
            [key]
        );
        return rows.length ? rows[0][field] : null;
    };

    module.getObjectFields = async function (key, fields) {
        if (!key) {
            return null;
        }
        if (!Array.isArray(fields) || !fields.length) {
            return await module.getObject(key);
        }

        const res = await module.pool.query({
			name: 'getObjectFields',
            sql: `
SELECT JSON_OBJECTAGG(f.field, h.value) AS d
FROM (
    SELECT JSON_UNQUOTE(JSON_EXTRACT(f.value, '$[0]')) AS field
    FROM JSON_TABLE(
        ?,
        '$[*]' COLUMNS (value JSON PATH '$')
    ) f
) f
LEFT JOIN (
    SELECT 
        JSON_UNQUOTE(k.k) AS \`key\`,
        JSON_EXTRACT(h.data, CONCAT('$."', JSON_UNQUOTE(k.k), '"')) AS value
    FROM legacy_hash h
    INNER JOIN legacy_object_live o
        ON o._key = h._key
        AND o.type = h.type
    CROSS JOIN JSON_TABLE(
        JSON_KEYS(h.data),
        '$[*]' COLUMNS (k JSON PATH '$')
    ) k
    WHERE o._key = ?
) h
ON h.key = f.field
            `,
            values: [JSON.stringify(fields), key],
        });

        if (res.length) {
            return res[0].d;
        }

        const obj = {};
        fields.forEach((f) => {
            obj[f] = null;
        });

        return obj;
    };

    module.getObjectsFields = async function (keys, fields) {
        if (!Array.isArray(keys) || !keys.length || !Array.isArray(fields) || !fields.length) {
            return [];
        }

        const sql = `SELECT _key, ${fields.join(', ')} FROM hash WHERE _key IN (?)`;
        const [rows] = await module.pool.query(sql, [keys]);

        return keys.map(key => {
            const row = rows.find(r => r._key === key);
            if (!row) {
                return fields.reduce((acc, field) => {
                    acc[field] = null;
                    return acc;
                }, {});
            }
            return row;
        });
    };

    module.getObjectKeys = async function (key) {
        if (!key) {
            return [];
        }

        const [rows] = await module.pool.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'hash' AND TABLE_SCHEMA = DATABASE()`
        );
        return rows.map(row => row.COLUMN_NAME).filter(column => column !== '_key');
    };

    module.getObjectValues = async function (key) {
        const data = await module.getObject(key);
        return data ? Object.values(data) : [];
    };

    module.isObjectField = async function (key, field) {
        if (!key || !field) {
            return false;
        }

        const value = await module.getObjectField(key, field);
        return value !== null && value !== undefined;
    };

    module.isObjectFields = async function (key, fields) {
        if (!key || !Array.isArray(fields) || !fields.length) {
            return [];
        }

        const data = await module.getObjectFields(key, fields);
        return fields.map(field => data && data[field] !== null && data[field] !== undefined);
    };

    module.deleteObjectField = async function (key, field) {
        if (!key || !field) {
            return;
        }

        await module.pool.query(
            `UPDATE hash SET ${field} = NULL WHERE _key = ?`,
            [key]
        );
    };

    module.deleteObjectFields = async function (key, fields) {
        if (!key || !Array.isArray(fields) || !fields.length) {
            return;
        }

        const updates = fields.map(field => `${field} = NULL`).join(', ');
        await module.pool.query(
            `UPDATE hash SET ${updates} WHERE _key = ?`,
            [key]
        );
    };

    module.incrObjectField = async function (key, field) {
        return await module.incrObjectFieldBy(key, field, 1);
    };

    module.decrObjectField = async function (key, field) {
        return await module.incrObjectFieldBy(key, field, -1);
    };

    module.incrObjectFieldBy = async function (key, field, value) {
        if (!key || !field || isNaN(value)) {
            return null;
        }

        await module.pool.query(
            `INSERT INTO hash (_key, ${field})
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE ${field} = COALESCE(${field}, 0) + ?`,
            [key, value, value]
        );

        return await module.getObjectField(key, field);
    };
};
