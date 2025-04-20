'use strict';

module.exports = function (module) {
    const helpers = require('./helpers');

    // Helper function to ensure JSON array compatibility
    const toJsonArray = (value) => Array.isArray(value) ? value : [value];

    // Prepend value(s) to the list
    module.listPrepend = async function (key, value) {
        if (!key) {
            return;
        }

        return module.transaction(async (connection) => {
            await helpers.ensureLegacyObjectType(connection, key, 'list');
            value = toJsonArray(value).reverse(); // Reverse to maintain order for prepend

            await connection.query({
                sql: `
                    INSERT INTO legacy_list (_key, array)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE array = JSON_ARRAY_INSERT(
                        legacy_list.array,
                        '$[0]',
                        ${value.map(() => '?').join(', ')}
                    )
                `,
                values: [key, JSON.stringify(value), ...value],
            });
        });
    };

    // Append value(s) to the list
    module.listAppend = async function (key, value) {
        if (!key) {
            return;
        }

        return module.transaction(async (connection) => {
            value = toJsonArray(value);

            await helpers.ensureLegacyObjectType(connection, key, 'list');
            await connection.query({
                sql: `
                    INSERT INTO legacy_list (_key, array)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE array = JSON_ARRAY_APPEND(
                        legacy_list.array,
                        '$',
                        ${value.map(() => '?').join(', ')}
                    )
                `,
                values: [key, JSON.stringify(value), ...value],
            });
        });
    };

    // Remove and return the last element of the list
    module.listRemoveLast = async function (key) {
        if (!key) {
            return;
        }

        const [rows] = await module.pool.query({
            sql: `
                UPDATE legacy_list l
                INNER JOIN legacy_object_live o
                    ON o._key = l._key AND o.type = l.type
                SET l.array = JSON_REMOVE(l.array, '$[last]')
                WHERE l._key = ?
                RETURNING JSON_EXTRACT(l.array, '$[last]') AS v
            `,
            values: [key],
        });

        return rows.length && rows[0].v ? JSON.parse(rows[0].v) : null;
    };

    // Remove all occurrences of value(s) from the list
    module.listRemoveAll = async function (key, value) {
        if (!key) {
            return;
        }

        return module.transaction(async (connection) => {
            if (Array.isArray(value)) {
                // For multiple values, iterate over the array and remove each
                const [rows] = await connection.query({
                    sql: `
                        SELECT l.array
                        FROM legacy_list l
                        INNER JOIN legacy_object_live o
                            ON o._key = l._key AND o.type = l.type
                        WHERE l._key = ?
                    `,
                    values: [key],
                });

                if (!rows.length) return;

                let array = JSON.parse(rows[0].array);
                array = array.filter(item => !value.includes(item));

                await connection.query({
                    sql: `
                        UPDATE legacy_list l
                        INNER JOIN legacy_object_live o
                            ON o._key = l._key AND o.type = l.type
                        SET l.array = ?
                        WHERE l._key = ?
                    `,
                    values: [JSON.stringify(array), key],
                });
            } else {
                // For single value, filter out the value
                const [rows] = await connection.query({
                    sql: `
                        SELECT l.array
                        FROM legacy_list l
                        INNER JOIN legacy_object_live o
                            ON o._key = l._key AND o.type = l.type
                        WHERE l._key = ?
                    `,
                    values: [key],
                });

                if (!rows.length) return;

                let array = JSON.parse(rows[0].array);
                array = array.filter(item => item !== value);

                await connection.query({
                    sql: `
                        UPDATE legacy_list l
                        INNER JOIN legacy_object_live o
                            ON o._key = l._key AND o.type = l.type
                        SET l.array = ?
                        WHERE l._key = ?
                    `,
                    values: [JSON.stringify(array), key],
                });
            }
        });
    };

    // Trim the list to the specified range
    module.listTrim = async function (key, start, stop) {
        if (!key) {
            return;
        }

        return module.transaction(async (connection) => {
            stop += 1; // Adjust for inclusive stop

            const [rows] = await connection.query({
                sql: `
                    SELECT l.array
                    FROM legacy_list l
                    INNER JOIN legacy_object_live o
                        ON o._key = l._key AND o.type = l.type
                    WHERE l._key = ?
                `,
                values: [key],
            });

            if (!rows.length) return;

            let array = JSON.parse(rows[0].array);
            const length = array.length;

            // Handle negative indices
            if (start < 0) start = Math.max(0, length + start);
            if (stop < 0) stop = Math.max(0, length + stop);
            if (stop <= 0) stop = length;

            // Slice the array
            array = array.slice(start, stop);

            await connection.query({
                sql: `
                    UPDATE legacy_list l
                    INNER JOIN legacy_object_live o
                        ON o._key = l._key AND o.type = l.type
                    SET l.array = ?
                    WHERE l._key = ?
                `,
                values: [JSON.stringify(array), key],
            });
        });
    };

    // Get a range of elements from the list
    module.getListRange = async function (key, start, stop) {
        if (!key) {
            return;
        }

        const [rows] = await module.pool.query({
            sql: `
                SELECT l.array
                FROM legacy_list l
                INNER JOIN legacy_object_live o
                    ON o._key = l._key AND o.type = l.type
                WHERE l._key = ?
            `,
            values: [key],
        });

        if (!rows.length) return [];

        let array = rows[0].array;
        const length = array.length;

        // Handle negative indices
        if (start < 0) start = Math.max(0, length + start);
        if (stop < 0) stop = Math.max(0, length + stop);
        else stop += 1; // Adjust for inclusive stop

        // Slice the array
        return array.slice(start, stop);
    };

    // Get the length of the list
    module.listLength = async function (key) {
        const [rows] = await module.pool.query({
            sql: `
                SELECT JSON_LENGTH(l.array) AS l
                FROM legacy_list l
                INNER JOIN legacy_object_live o
                    ON o._key = l._key AND o.type = l.type
                WHERE l._key = ?
            `,
            values: [key],
        });

        return rows.length ? rows[0].l : 0;
    };
};