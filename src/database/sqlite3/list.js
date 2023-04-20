'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.listPrepend = async function (key, value) {
		if (!key) {
			return;
		}

		module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'list');
			value = Array.isArray(value) ? value : [value];
			value.reverse();
			const valueString = JSON.stringify(value);
			const params = {key, value:valueString};
			db.prepare(`
			INSERT INTO "legacy_list" ("_key", "array")
			VALUES (@key, @value)
			ON CONFLICT ("_key")
			DO UPDATE SET "array" = json_array_append(@value, "legacy_list"."array")`).run(params);
		});
	};

	module.listAppend = async function (key, value) {
		if (!key) {
			return;
		}
		module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'list');
			value = Array.isArray(value) ? value : [value];
			const valueString = JSON.stringify(value);
			const params = {key, value:valueString};
			db.prepare(`
			INSERT INTO "legacy_list" ("_key", "array")
			VALUES (@key, @value)
			ON CONFLICT ("_key")
			DO UPDATE SET "array" = json_array_append("legacy_list"."array", @value)`).run(params);
		});
	};

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}

		return module.transaction((db) => {
			const params = {key};
			db.prepare(`
			UPDATE "legacy_list" l
			   SET "array" = json_array_remove_last(l."array")
			WHERE l."_key" = @key`).run(params);
			const res = db.prepare(`
			SELECT l."array" a
			FROM "legacy_list" l
			WHERE l."_key" = @key`).get(params);
			return res ? JSON.parse(res.a) : null;
		});
	};

	module.listRemoveAll = async function (key, value) {
		if (!key) {
			return;
		}
		value = Array.isArray(value) ? value : [value];
		const valueString = JSON.stringify(value);
		const params = {key, value:valueString};
		db.prepare(`
		UPDATE "legacy_list" l
		SET "array" = json_array_remove(l."array", @value)
		FROM "legacy_object_live" o
		WHERE o."_key" = l."_key"
			AND o."type" = l."type"
			AND o."_key" = @key`).run(params);
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}

		stop += 1;

		const params = {key, start, stop};
		db.prepare(`
		UPDATE "legacy_list" l
		SET "array" = json_array_slice(l."array", @start, @stop)
		FROM "legacy_object_live" o
		WHERE o."_key" = l."_key"
			AND o."type" = l."type"
			AND o."_key" = @key`).run(params);	
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}

		stop += 1;

		const params = {key, start, stop};
		const res = module.db.prepare(`
		SELECT json_array_slice(l."array", @start, @stop) l
		FROM "legacy_object_live" o
		INNER JOIN "legacy_list" l
						ON o."_key" = l."_key"
					 AND o."type" = l."type"
				 WHERE o."_key" = @key`).get(params);

		return res ? JSON.parse(res.l) : [];
	};

	module.listLength = async function (key) {
		const params = {key};
		const res = module.db.prepare(`
		SELECT json_array_length(l."array") l
		FROM "legacy_object_live" o
		INNER JOIN "legacy_list" l
						ON o."_key" = l."_key"
					 AND o."type" = l."type"
				 WHERE o."_key" = @key`).get(params);

		return res ? res.l : 0;
	};
};
