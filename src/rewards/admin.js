'use strict';

const plugins = require('../plugins');
const db = require('../database');
const utils = require('../utils');

const rewards = module.exports;

rewards.save = async function (data) {
	async function save(data) {
		if (!Object.keys(data.rewards).length) {
			return;
		}
		const rewardsData = data.rewards;
		delete data.rewards;
		if (!parseInt(data.id, 10)) {
			data.id = await db.incrObjectField('global', 'rewards:id');
		}
		await rewards.delete(data);
		await db.setAdd('rewards:list', data.id);
		await db.setObject('rewards:id:' + data.id, data);
		await db.setObject('rewards:id:' + data.id + ':rewards', rewardsData);
	}

	await Promise.all(data.map(data => save(data)));
	await saveConditions(data);
};

rewards.delete = async function (data) {
	await Promise.all([
		db.setRemove('rewards:list', data.id),
		db.delete('rewards:id:' + data.id),
		db.delete('rewards:id:' + data.id + ':rewards'),
	]);
};

rewards.get = async function () {
	return await utils.promiseParallel({
		active: getActiveRewards(),
		conditions: plugins.hooks.fire('filter:rewards.conditions', []),
		conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
		rewards: plugins.hooks.fire('filter:rewards.rewards', []),
	});
};

async function saveConditions(data) {
	const rewardsPerCondition = {};
	await db.delete('conditions:active');
	const conditions = [];

	data.forEach(function (reward) {
		conditions.push(reward.condition);
		rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
		rewardsPerCondition[reward.condition].push(reward.id);
	});

	await db.setAdd('conditions:active', conditions);

	await Promise.all(Object.keys(rewardsPerCondition).map(c => db.setAdd('condition:' + c + ':rewards', rewardsPerCondition[c])));
}

async function getActiveRewards() {
	async function load(id) {
		const [main, rewards] = await Promise.all([
			db.getObject('rewards:id:' + id),
			db.getObject('rewards:id:' + id + ':rewards'),
		]);
		if (main) {
			main.disabled = main.disabled === 'true';
			main.rewards = rewards;
		}
		return main;
	}

	const rewardsList = await db.getSetMembers('rewards:list');
	const rewardData = await Promise.all(rewardsList.map(id => load(id)));
	return rewardData.filter(Boolean);
}

require('../promisify')(rewards);
