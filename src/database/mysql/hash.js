'use strict';

module.exports = function (module) {
    module.setObject = async function (key, data) {
        if (!key || !data || !Object.keys(data).length) {
            return;
        }

        const fields = Object.keys(data).map(field => `${field} = ?`).join(', ');
        const values = Object.values(data);

        await module.pool.query(
            `INSERT INTO hash (_key, ${Object.keys(data).join(', ')})
             VALUES (?, ${values.map(() => '?').join(', ')})
             ON DUPLICATE KEY UPDATE ${fields}`,
            [key, ...values, ...values]
        );
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
        if (!key || !Array.isArray(fields) || !fields.length) {
            return null;
        }

        const sql = `SELECT ${fields.join(', ')} FROM hash WHERE _key = ?`;
        const [rows] = await module.pool.query(sql, [key]);
        return rows.length ? rows[0] : null;
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
