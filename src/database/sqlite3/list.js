'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.listPrepend = async function (key, values) {
		if (!key) {
			return;
		}

		module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'list');
			values = helpers.valuesToStrings(values);
			values.reverse();
			const params = { key, array: JSON.stringify(values) };
			db.prepare(`
			INSERT INTO "legacy_list" ("_key", "array")
			VALUES (@key, @array)
			ON CONFLICT ("_key")
			DO UPDATE SET "array" = json_array_append(@array, "legacy_list"."array")`).run(params);
		});
	};

	module.listAppend = async function (key, values) {
		if (!key) {
			return;
		}
		module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'list');
			values = helpers.valuesToStrings(values);
			const params = { key, array: JSON.stringify(values) };
			db.prepare(`
			INSERT INTO "legacy_list" ("_key", "array")
			VALUES (@key, @array)
			ON CONFLICT ("_key")
			DO UPDATE SET "array" = json_array_append("legacy_list"."array", @array)`).run(params);
		});
	};

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}

		return module.transaction((db) => {
			const params = { key };
			const res = db.prepare(`
			SELECT l."array" a
			FROM "legacy_object_live" o
			INNER JOIN "legacy_list" l
				 ON o."_key" = l."_key"
				AND o."type" = l."type"
			WHERE o."_key" = @key`).get(params);
			if (!res) {
				return null;
			}
			const array = JSON.parse(res.a);
			const value = array.pop() ?? null;
			
			params.array = JSON.stringify(array);
			db.prepare(`
			UPDATE "legacy_list"
			SET "array" = @array
			WHERE EXISTS (
				SELECT * FROM "legacy_object_live" o
				WHERE o."_key" = "legacy_list"."_key"
					AND o."type" = "legacy_list"."type"
					AND o."_key" = @key			
			)`).run(params);
								
			return value;
		});
	};

	module.listRemoveAll = async function (key, values) {
		if (!key) {
			return;
		}
		values = helpers.valuesToStrings(values);
		const params = { key, array: JSON.stringify(values) };
		module.db.prepare(`
		UPDATE "legacy_list"
		SET "array" = json_array_remove("array", @array)
		WHERE EXISTS (
			SELECT * FROM "legacy_object_live" o
			WHERE o."_key" = "legacy_list"."_key"
				AND o."type" = "legacy_list"."type"
				AND o."_key" = @key			
		)`).run(params);
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}

		stop += 1;

		const params = { key, start, stop };
		module.db.prepare(`
		UPDATE "legacy_list"
		SET "array" = json_array_slice("array", @start, @stop)
		WHERE EXISTS (
			SELECT * FROM "legacy_object_live" o
			WHERE o."_key" = "legacy_list"."_key"
				AND o."type" = "legacy_list"."type"
				AND o."_key" = @key			
		)`).run(params);
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}

		stop += 1;

		const params = { key, start, stop };
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
		const params = { key };
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
