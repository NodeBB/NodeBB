'use strict';

const util = require('util');
const winston = require('winston');

const db = require('../database');
const plugins = require('../plugins');

const rewards = module.exports;

rewards.checkConditionAndRewardUser = async function (params) {
	try {
		const { uid, condition, method } = params;
		const isActive = await isConditionActive(condition);
		if (!isActive) {
			return;
		}
		const ids = await getIDsByCondition(condition);
		let rewardData = await getRewardDataByIDs(ids);
		// filter disabled
		rewardData = rewardData.filter(r => r && !(r.disabled === 'true' || r.disabled === true));

		for (const reward of rewardData) {
			const lockValue = `reward:lock:${uid}:${reward.id}`;
			/* eslint-disable no-await-in-loop */
			const count = await db.incrObjectField('locks', lockValue);
			if (count > 1) {
				winston.warn(`Reward lock already exists for uid ${uid} and reward ${reward.id}, skipping`);
			} else {
				try {
					const canClaim = await isClaimable(uid, reward);
					if (canClaim) {
						const isEligible = await checkCondition(reward, method);
						if (isEligible) {
							await giveRewards(uid, [reward]);
						}
					}
				} catch (err) {
					winston.error(err.stack);
				} finally {
					await db.deleteObjectFields('locks', [lockValue]);
				}
			}
		}
	} catch (err) {
		winston.error(err.stack);
	}
};

async function isConditionActive(condition) {
	return await db.isSetMember('conditions:active', condition);
}

async function getIDsByCondition(condition) {
	return await db.getSetMembers(`condition:${condition}:rewards`);
}

async function isClaimable(uid, reward) {
	const timesClaimable = parseInt(reward.claimable, 10);
	if (timesClaimable === 0) { // no limit on how many times a user can claim this reward
		return true;
	}

	const userClaims = await db.sortedSetScore(`uid:${uid}:rewards`, reward.id);
	return !userClaims || userClaims < timesClaimable;
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
	const bool = await plugins.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, {
		left: value, right: reward.value,
	});
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
