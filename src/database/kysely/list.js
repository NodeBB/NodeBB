'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.listPrepend = async function (key, value) {
		if (!key) {
			return;
		}

		await helpers.withTransaction(module, key, 'list', async (client) => {
			const values = Array.isArray(value) ? value : [value];

			// When prepending array ['a', 'b', 'c'], each element is prepended in sequence:
			// 'a' -> list is ['a']
			// 'b' -> list is ['b', 'a']
			// 'c' -> list is ['c', 'b', 'a']
			for (const v of values) {
				// Shift all existing indices up by 1
				await client.updateTable('legacy_list')
					.set(eb => ({
						idx: eb('idx', '+', 1),
					}))
					.where('_key', '=', key)
					.execute();

				// Insert new element at index 0
				await client.insertInto('legacy_list')
					.values({
						_key: key,
						idx: 0,
						value: helpers.valueToString(v),
					})
					.execute();
			}
		});
	};

	module.listAppend = async function (key, value) {
		if (!key) {
			return;
		}

		await helpers.withTransaction(module, key, 'list', async (client) => {
			// Get the current max index
			const maxResult = await client.selectFrom('legacy_list')
				.select(eb => eb.fn.max('idx').as('maxIdx'))
				.where('_key', '=', key)
				.executeTakeFirst();

			let nextIdx = maxResult && maxResult.maxIdx !== null ? parseInt(maxResult.maxIdx, 10) + 1 : 0;

			// Insert new elements at the end
			const values = Array.isArray(value) ? value : [value];
			for (const v of values) {
				await client.insertInto('legacy_list')
					.values({
						_key: key,
						idx: nextIdx,
						value: helpers.valueToString(v),
					})
					.execute();
				nextIdx += 1;
			}
		});
	};

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}

		return await helpers.withTransaction(module, null, null, async (client, dialect) => {
			const now = helpers.getCurrentTimestamp(dialect);

			// Get the last element
			const last = await client.selectFrom('legacy_object as o')
				.innerJoin('legacy_list as l', 'l._key', 'o._key')
				.select(['l.idx', 'l.value'])
				.where('o._key', '=', key)
				.where('o.type', '=', 'list')
				.where(eb => eb.or([
					eb('o.expireAt', 'is', null),
					eb('o.expireAt', '>', now),
				]))
				.orderBy('l.idx', 'desc')
				.limit(1)
				.executeTakeFirst();

			if (!last) {
				return null;
			}

			// Remove the last element
			await client.deleteFrom('legacy_list')
				.where('_key', '=', key)
				.where('idx', '=', last.idx)
				.execute();

			return last.value;
		});
	};

	module.listRemoveAll = async function (key, value) {
		if (!key) {
			return;
		}

		const values = Array.isArray(value) ? value.map(helpers.valueToString) : [helpers.valueToString(value)];

		await helpers.withTransaction(module, null, null, async (client) => {
			// Delete all elements with these values
			await client.deleteFrom('legacy_list')
				.where('_key', '=', key)
				.where('value', 'in', values)
				.execute();

			// Re-index the remaining elements to maintain contiguous indices
			await reindexList(client, key);
		});
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}

		await helpers.withTransaction(module, null, null, async (client) => {
			// Get current elements in order
			const elements = await client.selectFrom('legacy_list')
				.select(['idx', 'value'])
				.where('_key', '=', key)
				.orderBy('idx', 'asc')
				.execute();

			if (!elements.length) {
				return;
			}

			// Calculate actual start and stop indices
			const len = elements.length;
			const actualStart = start < 0 ? Math.max(0, len + start) : start;
			let actualStop = stop < 0 ? len + stop : stop;
			actualStop = Math.min(actualStop, len - 1);

			if (actualStart > actualStop || actualStart >= len) {
				// Remove all elements
				await client.deleteFrom('legacy_list')
					.where('_key', '=', key)
					.execute();
				return;
			}

			// Get indices to keep
			const indicesToKeep = elements.slice(actualStart, actualStop + 1).map(e => e.idx);

			// Delete elements outside the range
			if (indicesToKeep.length > 0) {
				await client.deleteFrom('legacy_list')
					.where('_key', '=', key)
					.where('idx', 'not in', indicesToKeep)
					.execute();

				// Re-index the remaining elements
				await reindexList(client, key);
			} else {
				await client.deleteFrom('legacy_list')
					.where('_key', '=', key)
					.execute();
			}
		});
	};

	async function reindexList(client, key) {
		// Get all elements in order
		const elements = await client.selectFrom('legacy_list')
			.select(['idx', 'value'])
			.where('_key', '=', key)
			.orderBy('idx', 'asc')
			.execute();

		if (!elements.length) {
			return;
		}

		// Delete all and re-insert with new indices
		await client.deleteFrom('legacy_list')
			.where('_key', '=', key)
			.execute();

		for (let i = 0; i < elements.length; i++) {
			await client.insertInto('legacy_list')
				.values({
					_key: key,
					idx: i,
					value: elements[i].value,
				})
				.execute();
		}
	}

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}

		// Get all elements in order first
		const elements = await helpers.createListQuery(module.db, module.dialect)
			.select('l.value')
			.where('o._key', '=', key)
			.orderBy('l.idx', 'asc')
			.execute();

		if (!elements.length) {
			return [];
		}

		const values = elements.map(e => e.value);
		return helpers.sliceWithNegativeIndices(values, start, stop);
	};

	module.listLength = async function (key) {
		if (!key) {
			return 0;
		}

		const result = await helpers.createListQuery(module.db, module.dialect)
			.select(eb => eb.fn.count('l.idx').as('count'))
			.where('o._key', '=', key)
			.executeTakeFirst();

		return result ? parseInt(result.count, 10) : 0;
	};
};