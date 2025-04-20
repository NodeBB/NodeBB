'use strict';

const _ = require('lodash');

/**
 * 
 * @param {import('../../../types/database').MySQLDatabase} module 
 */
module.exports = function (module) {
    const helpers = require('./helpers');

    module.setAdd = async function (key, value) {
        if (!Array.isArray(value)) {
            value = [value];
        }
        if (!value.length) {
            return;
        }

        const connection = await module.pool.getConnection();
        try {
            await connection.beginTransaction();
            await helpers.ensureLegacyObjectType(connection, key, 'set');
            
            await connection.query(`
                INSERT IGNORE INTO legacy_set (\`_key\`, member)
                VALUES ${value.map(() => '(?, ?)').join(',')}
            `, value.reduce((acc, val) => [...acc, key, val], []));

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    };

    module.setsAdd = async function (keys, value) {
        if (!Array.isArray(keys) || !keys.length) {
            return;
        }

        if (!Array.isArray(value)) {
            value = [value];
        }

        keys = _.uniq(keys);

        const connection = await module.pool.getConnection();
        try {
            await connection.beginTransaction();
            await helpers.ensureLegacyObjectsType(connection, keys, 'set');
            
            const values = keys.flatMap(k => value.map(v => [k, v]));
            await connection.query(`
                INSERT IGNORE INTO legacy_set (\`_key\`, member)
                VALUES ${values.map(() => '(?, ?)').join(',')}
            `, values.flat());

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    };

    module.setRemove = async function (key, value) {
        if (!Array.isArray(key)) {
            key = [key];
        }
        if (!Array.isArray(value)) {
            value = [value];
        }
        if (!key.length || !value.length) {
            return;
        }

        await module.pool.query(`
            DELETE FROM legacy_set
            WHERE \`_key\` IN (?)
            AND member IN (?)
        `, [key, value]);
    };

    module.setsRemove = async function (keys, value) {
        if (!Array.isArray(keys) || !keys.length) {
            return;
        }

        await module.pool.query(`
            DELETE FROM legacy_set
            WHERE \`_key\` IN (?)
            AND member = ?
        `, [keys, value]);
    };

    module.isSetMember = async function (key, value) {
        if (!key) {
            return false;
        }

        const [rows] = await module.pool.query(`
            SELECT 1
            FROM legacy_object_live o
            INNER JOIN legacy_set s
            ON o.\`_key\` = s.\`_key\`
            AND o.\`type\` = s.\`type\`
            WHERE o.\`_key\` = ?
            AND s.member = ?
        `, [key, value]);

        return !!rows.length;
    };

    module.isSetMembers = async function (key, values) {
        if (!key || !Array.isArray(values) || !values.length) {
            return [];
        }

        values = values.map(helpers.valueToString);
        const [rows] = await module.pool.query(`
            SELECT s.member AS m
            FROM legacy_object_live o
            INNER JOIN legacy_set s
            ON o.\`_key\` = s.\`_key\`
            AND o.\`type\` = s.\`type\`
            WHERE o.\`_key\` = ?
            AND s.member IN (?)
        `, [key, values]);

        return values.map(v => rows.some(r => r.m === v));
    };

    module.isMemberOfSets = async function (sets, value) {
        if (!Array.isArray(sets) || !sets.length) {
            return [];
        }

        value = helpers.valueToString(value);
        const [rows] = await module.pool.query(`
            SELECT o.\`_key\` AS k
            FROM legacy_object_live o
            INNER JOIN legacy_set s
            ON o.\`_key\` = s.\`_key\`
            AND o.\`type\` = s.\`type\`
            WHERE o.\`_key\` IN (?)
            AND s.member = ?
        `, [sets, value]);

        return sets.map(s => rows.some(r => r.k === s));
    };

    module.getSetMembers = async function (key) {
        if (!key) {
            return [];
        }

        const [rows] = await module.pool.query(`
            SELECT s.member AS m
            FROM legacy_object_live o
            INNER JOIN legacy_set s
            ON o.\`_key\` = s.\`_key\`
            AND o.\`type\` = s.\`type\`
            WHERE o.\`_key\` = ?
        `, [key]);

        return rows.map(r => r.m);
    };

    module.getSetsMembers = async function (keys) {
        if (!Array.isArray(keys) || !keys.length) {
            return [];
        }

        const [rows] = await module.pool.query(`
            SELECT o.\`_key\` AS k, GROUP_CONCAT(s.member) AS m
            FROM legacy_object_live o
            INNER JOIN legacy_set s
            ON o.\`_key\` = s.\`_key\`
            AND o.\`type\` = s.\`type\`
            WHERE o.\`_key\` IN (?)
            GROUP BY o.\`_key\`
        `, [keys]);

        return keys.map(k => {
            const row = rows.find(r => r.k === k);
            return row ? row.m.split(',') : [];
        });
    };

    module.setCount = async function (key) {
        if (!key) {
            return 0;
        }

        const [rows] = await module.pool.query(`
            SELECT COUNT(*) AS c
            FROM legacy_object_live o
            INNER JOIN legacy_set s
            ON o.\`_key\` = s.\`_key\`
            AND o.\`type\` = s.\`type\`
            WHERE o.\`_key\` = ?
        `, [key]);

        return parseInt(rows[0].c, 10);
    };

    module.setsCount = async function (keys) {
        if (!keys.length) {
            return [];
        }

        const [rows] = await module.pool.query(`
            SELECT o.\`_key\` AS k, COUNT(*) AS c
            FROM legacy_object_live o
            INNER JOIN legacy_set s
            ON o.\`_key\` = s.\`_key\`
            AND o.\`type\` = s.\`type\`
            WHERE o.\`_key\` IN (?)
            GROUP BY o.\`_key\`
        `, [keys]);

        return keys.map(k => parseInt((rows.find(r => r.k === k) || { c: 0 }).c, 10));
    };

    module.setRemoveRandom = async function (key) {
        const connection = await module.pool.getConnection();
        try {
            await connection.beginTransaction();
            
            const [rows] = await connection.query(`
                SELECT s.member
                FROM legacy_object_live o
                INNER JOIN legacy_set s
                ON o.\`_key\` = s.\`_key\`
                AND o.\`type\` = s.\`type\`
                WHERE o.\`_key\` = ?
                ORDER BY RAND()
                LIMIT 1
            `, [key]);

            if (!rows.length) {
                await connection.commit();
                return null;
            }

            const member = rows[0].member;
            await connection.query(`
                DELETE FROM legacy_set
                WHERE \`_key\` = ?
                AND member = ?
                LIMIT 1
            `, [key, member]);

            await connection.commit();
            return member;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    };
};