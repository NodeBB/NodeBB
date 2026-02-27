'use strict';

/**
 * List operations for Kysely database backend.
 *
 * This module implements Redis-compatible list operations using SQL.
 * Position-based ordering allows O(1) append/prepend without reindexing.
 *
 * Design: Positions use integer increments only.
 * - Append: max_position + 1
 * - Prepend: min_position - 1 (for each element in reverse order)
 * - Delete: No reindexing needed (gaps in indices are fine)
 *
 * Uses INTEGER for position field for maximum database compatibility.
 * Range: -2,147,483,648 to 2,147,483,647 (~4.3 billion total elements).
 */

module.exports = function (module) {
	const { helpers } = module;

	/**
	 * Get boundary positions for a list.
	 */
	async function getBounds(client, key) {
		const result = await client.selectFrom('legacy_list')
			.select(eb => [
				eb.fn.min('idx').as('minIdx'),
				eb.fn.max('idx').as('maxIdx'),
				eb.fn.count('idx').as('count'),
			])
			.where('_key', '=', key)
			.executeTakeFirst();

		return {
			min: result.minIdx !== null ? parseInt(result.minIdx, 10) : null,
			max: result.maxIdx !== null ? parseInt(result.maxIdx, 10) : null,
			count: parseInt(result.count, 10),
		};
	}

	/**
	 * Prepend values to the beginning of a list.
	 * Uses position-based ordering: new elements get min_position - 1, - 2, etc.
	 * When prepending ['a', 'b', 'c'], result is ['c', 'b', 'a', ...existing]
	 */
	module.listPrepend = async function (key, value) {
		if (!key) {
			return;
		}

		await helpers.withTransaction(key, 'list', async (client) => {
			const values = Array.isArray(value) ? value : [value];
			// Reverse order so prepending ['a', 'b', 'c'] results in ['c', 'b', 'a', ...]
			const insertOrder = [...values].reverse();

			// Get current min position (or start at 0 if empty)
			const bounds = await getBounds(client, key);
			const startPos = bounds.min !== null ? bounds.min - insertOrder.length : 0;

			// Batch insert all elements with calculated positions
			const rows = insertOrder.map((v, i) => ({
				_key: key,
				idx: startPos + i,
				value: String(v),
			}));

			await helpers.insertMultiple(client, 'legacy_list', rows);
		});
	};

	/**
	 * Append values to the end of a list.
	 * Uses position-based ordering: new elements get max_position + 1, + 2, etc.
	 */
	module.listAppend = async function (key, value) {
		if (!key) {
			return;
		}

		await helpers.withTransaction(key, 'list', async (client) => {
			// Get current max position (or start at 0 if empty)
			const bounds = await getBounds(client, key);
			const startPos = bounds.max !== null ? bounds.max + 1 : 0;

			// Batch insert all elements with calculated positions
			const values = Array.isArray(value) ? value : [value];
			const rows = values.map((v, i) => ({
				_key: key,
				idx: startPos + i,
				value: String(v),
			}));

			await helpers.insertMultiple(client, 'legacy_list', rows);
		});
	};

	/**
	 * Remove and return the last element of a list.
	 * Uses conditional locking (FOR UPDATE) when supported by the database.
	 */
	module.listRemoveLast = async function (key) {
		if (!key) {
			return null;
		}

		return await helpers.withTransaction(null, null, async (client) => {
			const now = new Date().toISOString();

			// Build query for last element
			let query = client.selectFrom('legacy_object as o')
				.innerJoin('legacy_list as l', 'l._key', 'o._key')
				.select(['l.idx', 'l.value'])
				.where('o._key', '=', key)
				.where('o.type', '=', 'list')
				.where(eb => eb.or([
					eb('o.expireAt', 'is', null),
					eb('o.expireAt', '>', now),
				]))
				.orderBy('l.idx', 'desc')
				.limit(1);

			// Add locking if supported (checked during module.init)
			if (module.supportsLocking) {
				query = query.forUpdate();
			}

			const last = await query.executeTakeFirst();

			if (!last) {
				return null;
			}

			// Remove the last element (no reindexing needed - gaps are fine)
			await client.deleteFrom('legacy_list')
				.where('_key', '=', key)
				.where('idx', '=', last.idx)
				.execute();

			return last.value;
		});
	};

	/**
	 * Remove all occurrences of specified values from a list.
	 * No reindexing needed - gaps in indices are fine.
	 */
	module.listRemoveAll = async function (key, value) {
		if (!key) {
			return;
		}

		const values = Array.isArray(value) ? value.map(v => String(v)) : [String(value)];

		// Simple delete without reindexing - gaps are fine
		await module.db.deleteFrom('legacy_list')
			.where('_key', '=', key)
			.where('value', 'in', values)
			.execute();
	};

	/**
	 * Normalize negative indices and clamp to valid range.
	 */
	function normalizeRange(length, start, stop) {
		let actualStart = start < 0 ? length + start : start;
		let actualStop = stop < 0 ? length + stop : stop;

		actualStart = Math.max(0, actualStart);
		actualStop = Math.min(length - 1, actualStop);

		return { actualStart, actualStop };
	}

	/**
	 * Trim a list to only include elements within the specified range.
	 * No reindexing needed - gaps in indices are fine.
	 */
	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}

		await helpers.withTransaction(null, null, async (client) => {
			// Get all positions in order
			const positions = await client.selectFrom('legacy_list')
				.select('idx')
				.where('_key', '=', key)
				.orderBy('idx', 'asc')
				.execute();

			if (!positions.length) {
				return;
			}

			const { actualStart, actualStop } = normalizeRange(positions.length, start, stop);

			// If range is invalid, remove all elements
			if (actualStart > actualStop) {
				await client.deleteFrom('legacy_list')
					.where('_key', '=', key)
					.execute();
				return;
			}

			// Get positions to keep
			const keepPositions = positions.slice(actualStart, actualStop + 1).map(p => p.idx);

			// Delete elements outside the range (no reindexing needed)
			await client.deleteFrom('legacy_list')
				.where('_key', '=', key)
				.where(eb => eb.or([
					eb('idx', '<', keepPositions[0]),
					eb('idx', '>', keepPositions[keepPositions.length - 1]),
				]))
				.execute();
		});
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}

		// Get all elements in order first
		const elements = await helpers.createListQuery()
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

		const result = await helpers.createListQuery()
			.select(eb => eb.fn.count('l.idx').as('count'))
			.where('o._key', '=', key)
			.executeTakeFirst();

		return result ? parseInt(result.count, 10) : 0;
	};
};