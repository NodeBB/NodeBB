'use strict';

/**
 * 
 * @param {import('../mysql').MySQLDatabase} module 
 */
module.exports = function (module) {
	const helpers = require('./helpers');

	module.flushdb = async function () {
		const pool = module.pool;
	
		try {
			// Disable foreign key checks
			await pool.query('SET FOREIGN_KEY_CHECKS = 0');
	
			// Get list of tables in the current database
			const [rows] = await pool.query(`
				SELECT table_name 
				FROM information_schema.tables 
				WHERE table_schema = DATABASE()
			`);
	
			// Generate DROP TABLE statements for all tables
			if (rows.length > 0) {
				const dropStatements = rows.map(row => `DROP TABLE IF EXISTS ${row.table_name}`).join(';');
				await pool.query(dropStatements);
			}
		} catch (err) {
			throw err; // Re-throw the error after cleanup
		} finally {
			// Re-enable foreign key checks, even if an error occurs
			await pool.query('SET FOREIGN_KEY_CHECKS = 1');
		}
	};

	module.emptydb = async function () {
		await module.pool.query(`DELETE FROM legacy_object`);
	};

	module.exists = async function (key) {
		if (!key) {
			return;
		}
		const isArray = Array.isArray(key);
		if (isArray && !key.length) {
			return [];
		}

		async function checkIfzSetsExist(keys) {
			const members = await Promise.all(
				keys.map(key => module.getSortedSetRange(key, 0, 0))
			);
			return members.map(member => member.length > 0);
		}

		async function checkIfKeysExist(keys) {
			const [rows] = await module.pool.query(
				`SELECT _key k FROM legacy_object_live WHERE _key IN (?)`,
				[keys]
			);
			return keys.map(k => rows.some(r => r.k === k));
		}

		if (isArray) {
			const types = await Promise.all(key.map(module.type));
			const zsetKeys = key.filter((_key, i) => types[i] === 'zset');
			const otherKeys = key.filter((_key, i) => types[i] !== 'zset');
			const [zsetExists, otherExists] = await Promise.all([
				checkIfzSetsExist(zsetKeys),
				checkIfKeysExist(otherKeys),
			]);
			const existsMap = Object.create(null);
			zsetKeys.forEach((k, i) => { existsMap[k] = zsetExists[i]; });
			otherKeys.forEach((k, i) => { existsMap[k] = otherExists[i]; });
			return key.map(k => existsMap[k]);
		}

		const type = await module.type(key);
		if (type === 'zset') {
			const members = await module.getSortedSetRange(key, 0, 0);
			return members.length > 0;
		}

		const [rows] = await module.pool.query(
			`SELECT EXISTS(SELECT 1 FROM legacy_object_live WHERE _key = ? LIMIT 1) AS e`,
			[key]
		);
		return rows[0].e;
	};

	module.scan = async function (params) {
		let { match } = params;
		// MySQL uses % for wildcards instead of *
		match = match.replace(/^\*/, '%').replace(/\*$/, '%');

		const [rows] = await module.pool.query(
			`SELECT _key FROM legacy_object_live WHERE _key LIKE ?`,
			[match]
		);
		return rows.map(r => r._key);
	};

	module.delete = async function (key) {
		if (!key) {
			return;
		}

		await module.pool.query(
			`DELETE FROM legacy_object WHERE _key = ?`,
			[key]
		);
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		await module.pool.query(
			`DELETE FROM legacy_object WHERE _key IN (?)`,
			[keys]
		);
	};

	module.get = async function (key) {
		if (!key) {
			return;
		}

		const [rows] = await module.pool.query(
			`SELECT s.data t
             FROM legacy_object_live o
             INNER JOIN legacy_string s
             ON o._key = s._key AND o.type = s.type
             WHERE o._key = ?
             LIMIT 1`,
			[key]
		);

		return rows.length ? rows[0].t : null;
	};

	module.mget = async function (keys) {
		if (!keys || !Array.isArray(keys) || !keys.length) {
			return [];
		}

		const [rows] = await module.pool.query(
			`SELECT s.data, s._key
             FROM legacy_object_live o
             INNER JOIN legacy_string s
             ON o._key = s._key AND o.type = s.type
             WHERE o._key IN (?)`,
			[keys]
		);

		const map = {};
		rows.forEach((d) => {
			map[d._key] = d.data;
		});
		return keys.map(k => (map.hasOwnProperty(k) ? map[k] : null));
	};

	module.set = async function (key, value) {
		if (!key) {
			return;
		}

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'string');
			await client.query(
				`INSERT INTO legacy_string (_key, data)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE data = ?`,
				[key, value, value]
			);
		});
	};

	module.increment = async function (key) {
		if (!key) {
			return;
		}

		return await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'string');
			const [[row]] = await client.query(
				`INSERT INTO legacy_string (_key, data)
                 VALUES (?, '1')
                 ON DUPLICATE KEY UPDATE
                 data = CAST(CAST(data AS DECIMAL) + 1 AS CHAR)
                 RETURNING data AS d`,
				[key]
			);
			return parseFloat(row.d);
		});
	};

	module.rename = async function (oldKey, newKey) {
		await module.transaction(async (client) => {
			await client.query(
				`DELETE FROM legacy_object WHERE _key = ?`,
				[newKey]
			);
			await client.query(
				`UPDATE legacy_object SET _key = ? WHERE _key = ?`,
				[newKey, oldKey]
			);
		});
	};

	module.type = async function (key) {
		const [rows] = await module.pool.query(
			`SELECT type t FROM legacy_object_live WHERE _key = ? LIMIT 1`,
			[key]
		);
		return rows.length ? rows[0].t : null;
	};

	async function doExpire(key, date) {
		await module.pool.query(
			`UPDATE legacy_object SET expireAt = ? WHERE _key = ?`,
			[date, key]
		);
	}

	module.expire = async function (key, seconds) {
		await doExpire(key, new Date(((Date.now() / 1000) + seconds) * 1000));
	};

	module.expireAt = async function (key, timestamp) {
		await doExpire(key, new Date(timestamp * 1000));
	};

	module.pexpire = async function (key, ms) {
		await doExpire(key, new Date(Date.now() + parseInt(ms, 10)));
	};

	module.pexpireAt = async function (key, timestamp) {
		await doExpire(key, new Date(timestamp));
	};

	async function getExpire(key) {
		const [rows] = await module.pool.query(
			`SELECT expireAt FROM legacy_object WHERE _key = ? LIMIT 1`,
			[key]
		);
		return rows.length ? new Date(rows[0].expireAt).getTime() : null;
	}

	module.ttl = async function (key) {
		return Math.round((await getExpire(key) - Date.now()) / 1000);
	};

	module.pttl = async function (key) {
		return await getExpire(key) - Date.now();
	};
};