'use strict';

/**
 * @typedef {import('../../../types/database/hash').Hash} Hash
 */

/**
 * @param {Hash} module
 */
module.exports = function (module) {
    const helpers = require('./helpers');
    const mysql = require('mysql2/promise');

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

        const dataString = JSON.stringify(data);

        await module.transaction(async (connection) => {
            if (Array.isArray(key)) {
                await helpers.ensureLegacyObjectsType(connection, key, 'hash');
                const values = key.map(k => [k, dataString]);
                await connection.query(`
                    INSERT INTO legacy_hash (_key, data)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                    data = JSON_MERGE_PRESERVE(data, VALUES(data))
                `, [values]);
            } else {
                await helpers.ensureLegacyObjectType(connection, key, 'hash');
                await connection.query(`
                    INSERT INTO legacy_hash (_key, data)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE
                    data = JSON_MERGE_PRESERVE(data, VALUES(data))
                `, [key, dataString]);
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
            data = args[0].map((key, i) => [key, args[1][i]]);
        }

        await module.transaction(async (connection) => {
            data = data.filter((item) => {
                if (item[1].hasOwnProperty('')) {
                    delete item[1][''];
                }
                return !!Object.keys(item[1]).length;
            });
            if (!data.length) {
                return;
            }

            const values = data.map(item => [item[0], JSON.stringify(item[1])]);
            await helpers.ensureLegacyObjectsType(connection, data.map(item => item[0]), 'hash');
            await connection.query(`
                INSERT INTO legacy_hash (_key, data)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                data = JSON_MERGE_PRESERVE(data, VALUES(data))
            `, [values]);
        });
    };

    module.setObjectField = async function (key, field, value) {
        if (!field) {
            return;
        }

        await module.transaction(async (connection) => {
            const valueString = JSON.stringify(value);
            if (Array.isArray(key)) {
                await module.setObject(key, { [field]: value });
            } else {
                await helpers.ensureLegacyObjectType(connection, key, 'hash');
                await connection.query(`
                    INSERT INTO legacy_hash (_key, data)
                    VALUES (?, JSON_OBJECT(?, ?))
                    ON DUPLICATE KEY UPDATE
                    data = JSON_SET(data, CONCAT('$."', ?, '"'), ?)
                `, [key, field, valueString, field, valueString]);
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
        const [rows] = await module.pool.query(`
            SELECT h.data
            FROM legacy_object_live o
            INNER JOIN legacy_hash h
            ON o._key = h._key
            AND o.type = h.type
            WHERE o._key = ?
            LIMIT 1
        `, [key]);

        return rows.length ? rows[0].data : null;
    };

    module.getObjects = async function (keys, fields = []) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }
        if (fields.length) {
            return await module.getObjectsFields(keys, fields);
        }
        const [rows] = await module.pool.query(`
            SELECT h.data
            FROM legacy_hash h
            WHERE h._key IN (?)
            ORDER BY FIELD(h._key, ?)
        `, [keys, keys]);

        return rows.map(row => row.data);
    };

    module.getObjectField = async function (key, field) {
        if (!key) {
            return null;
        }

        const [rows] = await module.pool.query(`
            SELECT JSON_EXTRACT(h.data, CONCAT('$.', ?)) AS f
            FROM legacy_object_live o
            INNER JOIN legacy_hash h
            ON o._key = h._key
            AND o.type = h.type
            WHERE o._key = ?
            LIMIT 1
        `, [field, key]);

        return rows.length ? JSON.parse(rows[0].f) : null;
    };

    module.getObjectFields = async function (key, fields) {
        if (!key) {
            return null;
        }
        if (!Array.isArray(fields) || !fields.length) {
            return await module.getObject(key);
        }

        const [rows] = await module.pool.query(`
            SELECT JSON_OBJECT(
                ${fields.map(f => `${mysql.escape(f)}, JSON_EXTRACT(h.data, CONCAT('$.', ${mysql.escape(`"${f}"`)}))`).join(',')}
            ) AS d
            FROM legacy_object_live o
            INNER JOIN legacy_hash h
            ON o._key = h._key
            AND o.type = h.type
            WHERE o._key = ?
        `, [key]);

        return rows.length ? rows[0].d : fields.reduce((obj, f) => ({ ...obj, [f]: null }), {});
    };

    module.getObjectsFields = async function (keys, fields) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }
        if (!Array.isArray(fields) || !fields.length) {
            return await module.getObjects(keys);
        }
    
        const sql = `
            WITH KeyList AS (
                SELECT _key COLLATE utf8mb4_0900_ai_ci AS _key, ROW_NUMBER() OVER () AS i
                FROM JSON_TABLE(
                    ?,
                    '$[*]' COLUMNS (_key VARCHAR(255) PATH '$')
                ) AS jt
            )
            SELECT JSON_OBJECT(
                ${fields.map(f => `${mysql.escape(f)}, JSON_EXTRACT(h.data, CONCAT('$."', ${mysql.escape(f)}, '"'))`).join(',')}
            ) AS d
            FROM KeyList k
            LEFT JOIN legacy_object_live o ON o._key = k._key
            LEFT JOIN legacy_hash h ON h._key = o._key AND h.type = o.type
            ORDER BY k.i
        `;
        const [rows] = await module.pool.query(sql, [JSON.stringify(keys)]);
    
        return rows.map(row => row.d);
    };

    module.getObjectKeys = async function (key) {
        if (!key) {
            return;
        }

        const [rows] = await module.pool.query(`
            SELECT JSON_KEYS(h.data) AS k
            FROM legacy_object_live o
            INNER JOIN legacy_hash h
            ON o._key = h._key
            AND o.type = h.type
            WHERE o._key = ?
            LIMIT 1
        `, [key]);

        return rows.length ? JSON.parse(rows[0].k) : [];
    };

    module.getObjectValues = async function (key) {
        const data = await module.getObject(key);
        return data ? Object.values(data) : [];
    };

    module.isObjectField = async function (key, field) {
        if (!key) {
            return;
        }

        const [rows] = await module.pool.query(`
            SELECT JSON_CONTAINS_PATH(h.data, 'one', CONCAT('$."', ?, '"')) 
            AND JSON_EXTRACT(h.data, CONCAT('$."', ?, '"')) IS NOT NULL AS b
            FROM legacy_object_live o
            INNER JOIN legacy_hash h
            ON o._key = h._key
            AND o.type = h.type
            WHERE o._key = ?
            LIMIT 1
        `, [field, field, key]);

        return rows.length ? !!rows[0].b : false;
    };

    module.isObjectFields = async function (key, fields) {
        if (!key) {
            return;
        }

        const data = await module.getObjectFields(key, fields);
        if (!data) {
            return fields.map(() => false);
        }
        return fields.map(field => data.hasOwnProperty(field) && data[field] !== null);
    };

    module.deleteObjectField = async function (key, field) {
		await module.deleteObjectFields(key, Array.isArray(field) ? field : [field]);
	};

    module.deleteObjectFields = async function (key, fields) {
        if (!key || (Array.isArray(key) && !key.length) || !Array.isArray(fields) || !fields.length) {
            return;
        }

        const paths = fields.map(f => `$."${f}"`);
        if (Array.isArray(key)) {
            await module.pool.query(`
                UPDATE legacy_hash
                SET data = JSON_REMOVE(data, ${paths.map(p => '?').join(',')})
                WHERE _key IN (?)
            `, [...paths, key]);
        } else {
            await module.pool.query(`
                UPDATE legacy_hash
                SET data = JSON_REMOVE(data, ${paths.map(p => '?').join(',')})
                WHERE _key = ?
            `, [...paths, key]);
        }
    };

    module.incrObjectFieldBy = async function (key, field, value) {
        value = parseInt(value, 10);
        
        if (!key || isNaN(value)) {
            return null;
        }
        
        // Quote the field name to handle special characters
        const quotedField = `"${field.replace(/"/g, '\\"')}"`; // Escape any existing quotes
        
        return await module.transaction(async (connection) => {
            if (Array.isArray(key)) {
                await helpers.ensureLegacyObjectsType(connection, key, 'hash');
                const values = key.map(k => [k, JSON.stringify({ [field]: 0 })]);
                
                await connection.query(`
                    INSERT INTO legacy_hash (_key, data)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                    data = JSON_SET(
                        data,
                        CONCAT('$."', ?, '"'),
                        COALESCE(JSON_EXTRACT(data, CONCAT('$."', ?, '"')) + ?, 0 + ?)
                    )
                `, [values, field, field, value, value]);
                
                const [rows] = await connection.query(`
                    SELECT JSON_EXTRACT(data, CONCAT('$."', ?, '"')) AS v
                    FROM legacy_hash
                    WHERE _key IN (?)
                `, [field, key]);
                
                return rows.map(r => parseFloat(r.v));
            } else {
                await helpers.ensureLegacyObjectType(connection, key, 'hash');
                
                await connection.query(`
                    INSERT INTO legacy_hash (_key, data)
                    VALUES (?, JSON_OBJECT(?, ?))
                    ON DUPLICATE KEY UPDATE
                    data = JSON_SET(
                        data,
                        CONCAT('$."', ?, '"'),
                        COALESCE(JSON_EXTRACT(data, CONCAT('$."', ?, '"')) + ?, 0 + ?)
                    )
                `, [key, field, 0, field, field, value, value]);
                
                const [rows] = await connection.query(`
                    SELECT JSON_EXTRACT(data, CONCAT('$."', ?, '"')) AS v
                    FROM legacy_hash
                    WHERE _key = ?
                `, [field, key]);
                
                return parseFloat(rows[0].v);
            }
        });
    };

    // Add these to the module.exports function after the other methods

    module.incrObjectField = async function (key, field) {
        return await module.incrObjectFieldBy(key, field, 1);
    };

    module.decrObjectField = async function (key, field) {
        return await module.incrObjectFieldBy(key, field, -1);
    };

    module.incrObjectFieldByBulk = async function (data) {
        if (!Array.isArray(data) || !data.length) {
            return;
        }

        await module.transaction(async (connection) => {
            await helpers.ensureLegacyObjectsType(connection, data.map(item => item[0]), 'hash');

            const values = data.map(item => {
                const obj = {};
                for (const [field, value] of Object.entries(item[1])) {
                    obj[field] = parseInt(value, 10) || 0;
                }
                return [item[0], JSON.stringify(obj)];
            });

            // First, insert or update all records
            await connection.query(`
                INSERT INTO legacy_hash (_key, data)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                data = JSON_MERGE_PRESERVE(data, VALUES(data))
        `, [values]);

            // Then, update each field with the increment/decrement
            for (const [key, fields] of data) {
                for (const [field, value] of Object.entries(fields)) {
                    const numericValue = parseInt(value, 10) || 0;
                    await connection.query(`
                        UPDATE legacy_hash
                        SET data = JSON_SET(
                            data,
                            CONCAT('$.', ?),
                            COALESCE(JSON_EXTRACT(data, CONCAT('$.', ?)) + ?, ?)
                        )
                        WHERE _key = ?
                `, [field, field, numericValue, numericValue, key]);
                }
            }
        });
    };
};