'use strict';

const util = require('util');

const db = require('../database');
const plugins = require('../plugins');

const rewards = module.exports;

rewards.checkConditionAndRewardUser = async function (params) {
	const { uid, condition, method } = params;
	const isActive = await isConditionActive(condition);
	if (!isActive) {
		return;
	}
	const ids = await getIDsByCondition(condition);
	let rewardData = await getRewardDataByIDs(ids);
	// filter disabled
	rewardData = rewardData.filter(r => r && !(r.disabled === 'true' || r.disabled === true));
	rewardData = await filterCompletedRewards(uid, rewardData);
	if (!rewardData || !rewardData.length) {
		return;
	}
	const eligible = await Promise.all(rewardData.map(reward => checkCondition(reward, method)));
	const eligibleRewards = rewardData.filter((reward, index) => eligible[index]);
	await giveRewards(uid, eligibleRewards);
};

async function isConditionActive(condition) {
	return await db.isSetMember('conditions:active', condition);
}

async function getIDsByCondition(condition) {
	return await db.getSetMembers(`condition:${condition}:rewards`);
}

async function filterCompletedRewards(uid, rewards) {
	const data = await db.getSortedSetRangeByScoreWithScores(`uid:${uid}:rewards`, 0, -1, 1, '+inf');
	const userRewards = {};

	data.forEach((obj) => {
		userRewards[obj.value] = parseInt(obj.score, 10);
	});

	return rewards.filter((reward) => {
		if (!reward) {
			return false;
		}

		const claimable = parseInt(reward.claimable, 10);
		return claimable === 0 || (!userRewards[reward.id] || userRewards[reward.id] < reward.claimable);
	});
}

async function getRewardDataByIDs(ids) {
	return await db.getObjects(ids.map(id => `rewards:id:${id}`));
}

async function getRewardsByRewardData(rewards) {
	return await db.getObjects(rewards.map(reward => `rewards:id:${reward.id}:rewards`));
}

async function checkCondition(reward, method) {
	if (method.constructor && method.constructor.name !== 'AsyncFunction') {
		method = util.promisify(method);
	}
	const value = await method();
	const bool = await plugins.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, { left: value, right: reward.value });
	return bool;
}

async function giveRewards(uid, rewards) {
	const rewardData = await getRewardsByRewardData(rewards);
	for (let i = 0; i < rewards.length; i++) {
		/* eslint-disable no-await-in-loop */
		await plugins.hooks.fire(`action:rewards.award:${rewards[i].rid}`, {
			uid: uid,
			rewardData: rewards[i],
			reward: rewardData[i],
		});
		await db.sortedSetIncrBy(`uid:${uid}:rewards`, 1, rewards[i].id);
	}
}

require('../promisify')(rewards);
