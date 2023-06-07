'use strict';

module.exports = function (module) {
	module.sortedSetUnionCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}

		const data = await module.client.getCollection('objects').findMany({
			filter: { $or: keys.map(k => ({ _key: k })) },
			fields: { include: ['value'] },
		}).toArray();

		if (!data || !data.length) {
			return 0;
		}
		const uniqueValues = new Set();
		data.forEach((item) => {
			uniqueValues.add(item.value);
		});

		return uniqueValues.size;
	};

	module.getSortedSetUnion = async function (params) {
		params.sort = 1;
		return await getSortedSetUnion(params);
	};

	module.getSortedSetRevUnion = async function (params) {
		params.sort = -1;
		return await getSortedSetUnion(params);
	};

	async function getSortedSetUnion(params) {
		if (!Array.isArray(params.sets) || !params.sets.length) {
			return [];
		}

		let limit = params.stop - params.start + 1;
		if (limit <= 0) {
			limit = 0;
		}

		// Fetch the documents with matching keys
		const documents = await module.client.getCollection('objects').findMany({
			filter: { $or: params.sets.map(k => ({ _key: k })) },
		}).toArray();

		// Group by value and calculate totalScore based on the aggregate function
		const grouped = {};
		for (const doc of documents) {
			if (!(doc.value in grouped)) {
				grouped[doc.value] = {
					value: doc.value,
					totalScore: 0,
					count: 0,
				};
			}

			if (params.aggregate === 'AVG') {
				grouped[doc.value].totalScore += doc.score;
				grouped[doc.value].count += 1;
			} else if (params.aggregate === 'MAX') {
				grouped[doc.value].totalScore = Math.max(grouped[doc.value].totalScore, doc.score);
			} else if (params.aggregate === 'MIN') {
				grouped[doc.value].totalScore = Math.min(grouped[doc.value].totalScore, doc.score);
			} else { // default to SUM
				grouped[doc.value].totalScore += doc.score;
			}
		}

		if (params.aggregate === 'AVG') {
			for (const item of Object.keys(grouped)) {
				grouped[item].totalScore /= grouped[item].count;
			}
		}

		// Convert grouped object to array
		let data = Object.values(grouped);

		// Sort the array
		data.sort((a, b) => (params.sort === 1 ? a.totalScore - b.totalScore : b.totalScore - a.totalScore));

		// Apply pagination
		if (params.start && limit > 0) {
			data = data.slice(params.start, params.start + limit);
		}

		// Project the fields
		if (!params.withScores) {
			data = data.map(item => item.value);
		}
		// else {
		// data = data.map(item => ({ value: item.value, score: item.totalScore }));
		// }

		return data;
	}
};
