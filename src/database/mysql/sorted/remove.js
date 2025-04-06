'use strict';

/**
 * @typedef {import('../../../../types/database').MySQLDatabase} MySQLDatabase
 */

/**
 * 
 * @param {MySQLDatabase} module 
 */
module.exports = function (module) {
    const helpers = require('../helpers');

    module.sortedSetRemove = async function (key, value) {
        if (!key) {
            return;
        }
        const isValueArray = Array.isArray(value);
        if (!value || (isValueArray && !value.length)) {
            return;
        }

        if (!Array.isArray(key)) {
            key = [key];
        }

        if (!isValueArray) {
            value = [value];
        }
        value = value.map(helpers.valueToString);

        const [rows] = await module.pool.query({
            sql: `
                DELETE FROM legacy_zset
                WHERE _key IN (${key.map(() => '?').join(', ')})
                  AND value IN (${value.map(() => '?').join(', ')})
            `,
            values: [...key, ...value],
        });
    };

    module.sortedSetsRemove = async function (keys, value) {
        if (!Array.isArray(keys) || !keys.length) {
            return;
        }

        value = helpers.valueToString(value);

        const [rows] = await module.pool.query({
            sql: `
                DELETE FROM legacy_zset
                WHERE _key IN (${keys.map(() => '?').join(', ')})
                  AND value = ?
            `,
            values: [...keys, value],
        });
    };

    module.sortedSetsRemoveRangeByScore = async function (keys, min, max) {
        if (!Array.isArray(keys) || !keys.length) {
            return;
        }

        if (min === '-inf') {
            min = null;
        }
        if (max === '+inf') {
            max = null;
        }

        const conditions = [];
        const values = [...keys];
        
        if (min !== null) {
            conditions.push('score >= ?');
            values.push(min);
        }
        if (max !== null) {
            conditions.push('score <= ?');
            values.push(max);
        }
        const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

        const [rows] = await module.pool.query({
            sql: `
                DELETE FROM legacy_zset
                WHERE _key IN (${keys.map(() => '?').join(', ')})
                ${whereClause}
            `,
            values,
        });
    };

    module.sortedSetRemoveBulk = async function (data) {
        if (!Array.isArray(data) || !data.length) {
            return;
        }
        const keys = data.map(d => d[0]);
        const values = data.map(d => d[1]);

        const placeholders = data.map(() => '(?, ?)').join(', ');
        const flatValues = [];
        for (let i = 0; i < data.length; i++) {
            flatValues.push(keys[i], values[i]);
        }

        const [rows] = await module.pool.query({
            sql: `
                DELETE FROM legacy_zset
                WHERE (_key, value) IN (${placeholders})
            `,
            values: flatValues,
        });
    };
};