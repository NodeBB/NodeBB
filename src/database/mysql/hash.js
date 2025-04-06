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
        await module.transaction(async (poolConnection) => {
            const dataString = JSON.stringify(data);

            if (Array.isArray(key)) {
                await helpers.ensureLegacyObjectsType(poolConnection, key, 'hash');
                // For array of keys, we'll need to use a different approach since MySQL doesn't have UNNEST
                await poolConnection.query({
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
                await helpers.ensureLegacyObjectType(poolConnection, key, 'hash');
                await poolConnection.query({
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

    module.setObjectBulk = async function (...args) {
        let data = args[0];
        if (!Array.isArray(data) || !data.length) {
            return;
        }
        if (Array.isArray(args[1])) {
            console.warn('[deprecated] db.setObjectBulk(keys, data) usage is deprecated, please use db.setObjectBulk(data)');
            // convert old format to new format for backwards compatibility
            data = args[0].map((key, i) => [key, args[1][i]]);
        }
        await module.transaction(async (poolConnection) => {
            data = data.filter((item) => {
                if (item[1].hasOwnProperty('')) {
                    delete item[1][''];
                }
                return !!Object.keys(item[1]).length;
            });
            const keys = data.map(item => item[0]);
            if (!keys.length) {
                return;
            }

            await helpers.ensureLegacyObjectsType(poolConnection, keys, 'hash');
            await poolConnection.query({
                sql: `
                INSERT INTO legacy_hash (_key, data)
                VALUES ?
                ON DUPLICATE KEY UPDATE 
                data = JSON_MERGE_PATCH(data, VALUES(data))`,
                values: [data.map(item => [item[0], JSON.stringify(item[1])])]
            });
        });
    };

    module.setObjectField = async function (key, field, value) {
        if (!field) {
            return;
        }

        await module.transaction(async (client) => {
            const valueString = JSON.stringify(value);
            if (Array.isArray(key)) {
                await module.setObject(key, { [field]: value });
            } else {
                await helpers.ensureLegacyObjectType(client, key, 'hash');
                await client.query({
                    sql: `
                        INSERT INTO legacy_hash (_key, data)
                        VALUES (?, JSON_OBJECT(?, ?))
                        ON DUPLICATE KEY UPDATE
                        data = JSON_SET(data, CONCAT('$.', ?), ?)
                    `,
                    values: [key, field, valueString, field, valueString],
                });
            }
        });
    };

    module.getObject = async function (key, fields = []) {
        if (!key) {
            return null;
        }
        if (fields.length) {
            return await module.getObjectFields(key, fields);
        }
        const [rows] = await module.pool.query({
            sql: `
            SELECT h.data
            FROM legacy_object_live o
            INNER JOIN legacy_hash h
                ON o._key = h._key
                AND o.type = h.type
            WHERE o._key = ?
            LIMIT 1
            `,
            values: [key],
        });

        return rows.length ? rows[0].data : null;
    };

    module.getObjects = async function (keys, fields = []) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }
        if (fields.length) {
            return await module.getObjectsFields(keys, fields);
        }
        const [rows] = await module.pool.query({
            sql: `
            SELECT o._key, h.data
            FROM legacy_object_live o
            LEFT OUTER JOIN legacy_hash h
                ON o._key = h._key
                AND o.type = h.type
            WHERE o._key IN (?)
            `,
            values: [keys],
        });
        const keyDataMap = new Map(rows.map(row => [row._key, row.data]));
        return keys.map(key => keyDataMap.has(key) ? keyDataMap.get(key) : null);
    };

    module.getObjectField = async function (key, field) {
        if (!key) {
            return null;
        }

        const [rows] = await module.pool.query({
            sql: `
            SELECT JSON_UNQUOTE(JSON_EXTRACT(h.data, ?)) AS f
            FROM legacy_object_live o
            INNER JOIN legacy_hash h
                ON o._key = h._key
                AND o.type = h.type
            WHERE o._key = ?
            LIMIT 1
            `,
            values: [`$."${field}"`, key]
        });

        return rows.length ? rows[0].f : null;
    };

    module.getObjectFields = async function (key, fields) {
        if (!key) {
            return null;
        }
        if (!Array.isArray(fields) || !fields.length) {
            return await module.getObject(key);
        }

        const [rows] = await module.pool.query({
            sql: `
            SELECT 
                JSON_OBJECTAGG(t.key, t.value) AS d
            FROM (
                SELECT
                    JSON_UNQUOTE(jt.k) AS 'key',
                    JSON_EXTRACT(f.data, CONCAT('$.', jt.k)) AS 'value'
                FROM (
                    SELECT h.data AS 'data'
                    FROM legacy_object_live o
                    INNER JOIN legacy_hash h
                        ON o._key = h._key
                        AND o.type = h.type
                    WHERE o._key = ?
                    LIMIT 1
                ) f
                CROSS JOIN JSON_TABLE(
                    JSON_KEYS(f.data),
                    '$[*]' COLUMNS (k JSON PATH '$')
                ) jt
                WHERE jt.k IN (?)
            ) t;
            `,
            values: [key, fields]
        });

        const rawData = rows[0].d;
        if (!rawData) {
            const obj = {};
            fields.forEach((f) => {
                obj[f] = null;
            });

            return obj;
        }

        // Filter to only include specified fields
        const filteredData = {};
        fields.forEach(field => {
            filteredData[field] = rawData[field] !== undefined ? rawData[field] : null;
        });

        return filteredData;

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
