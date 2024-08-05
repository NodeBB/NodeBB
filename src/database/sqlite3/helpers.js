'use strict';

const helpers = module.exports;

helpers.valueToString = function (value) {
	return String(value);
};

helpers.valuesToStrings = function (values) {
	if (!Array.isArray(values)) {
		values = [values];
	}	
	return values.map(v => String(v));
};

helpers.aggregateScores = function (scores, method = 'SUM') {
	if (method === 'SUM') {
		return scores.reduce((t, s) => t + s, 0);
	} else if (method === 'MAX') {
		return Math.max.apply(null, scores);
	} else if (method === 'MIN') {
		return Math.min.apply(null, scores);
	}
};

helpers.removeDuplicateValues = function (values, ...others) {
	for (let i = 0; i < values.length; i++) {
		if (values.lastIndexOf(values[i]) !== i) {
			values.splice(i, 1);
			for (let j = 0; j < others.length; j++) {
				others[j].splice(i, 1);
			}
			i -= 1;
		}
	}
};

helpers.listParams = function(params, keys, prefix = 'key') {
	if (!Array.isArray(keys)) {
		keys = [keys];
	}
	const keyList = [];
	for (const [ i, k ] of keys.entries()) {
		const name = prefix + i;
		params[name] = k;
		keyList.push(`@${name}`);
	}
	return [params, keyList];
};

helpers.ensureLegacyObjectType = function (db, key, type) {
	db.exec(`
DELETE FROM "legacy_object"
	WHERE "expireAt" IS NOT NULL
  	AND "expireAt" <= CURRENT_TIMESTAMP`);

	db.prepare(`
INSERT INTO "legacy_object" ("_key", "type")
VALUES (@key, @type)
	ON CONFLICT
  DO NOTHING`).run({ key, type });

	const res = db.prepare(`
SELECT "type"
 	FROM "legacy_object_live"
 	WHERE "_key" = @key`).get({ key });

	if (res.type !== type) {
		throw new Error(`database: cannot insert ${JSON.stringify(key)} as ${type} because it already exists as ${res.type}`);
	}
};

helpers.ensureLegacyObjectsType = function (db, keys, type) {
	db.exec(`
	DELETE FROM "legacy_object"
 	WHERE "expireAt" IS NOT NULL
    AND "expireAt" <= CURRENT_TIMESTAMP`);

	const insert = db.prepare(`
	INSERT INTO "legacy_object" ("_key", "type")
	VALUES (@key, @type)
	ON CONFLICT
	DO NOTHING`);
	const select = db.prepare(`
	SELECT "_key", "type"
	FROM "legacy_object_live"
	WHERE "_key" = @key`);
	const invalid = [], missing = [];
	for (const key of keys) {
		insert.run({ key, type });
		const res = select.get({ key });
		if (!res) {
			missing.push(key);
		} else {
			if (res.type !== type) {
				invalid.push(res);
			}	
		}
	}

	if (invalid.length) {
		const parts = invalid.map(r => `${JSON.stringify(r._key)} is ${r.type}`);
		throw new Error(`database: cannot insert multiple objects as ${type} because they already exist: ${parts.join(', ')}`);
	}
	if (missing.length) {
		throw new Error(`database: failed to insert keys for objects: ${JSON.stringify(missing)}`);
	}
};

helpers.noop = function () {};
