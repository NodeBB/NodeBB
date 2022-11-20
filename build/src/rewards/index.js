'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util = require('util');
const database_1 = __importDefault(require("../database"));
const plugins = require('../plugins');
const rewards = {};
rewards.checkConditionAndRewardUser = function (params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { uid, condition, method } = params;
        const isActive = yield isConditionActive(condition);
        if (!isActive) {
            return;
        }
        const ids = yield getIDsByCondition(condition);
        let rewardData = yield getRewardDataByIDs(ids);
        rewardData = yield filterCompletedRewards(uid, rewardData);
        rewardData = rewardData.filter(Boolean);
        if (!rewardData || !rewardData.length) {
            return;
        }
        const eligible = yield Promise.all(rewardData.map(reward => checkCondition(reward, method)));
        const eligibleRewards = rewardData.filter((reward, index) => eligible[index]);
        yield giveRewards(uid, eligibleRewards);
    });
};
function isConditionActive(condition) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.isSetMember('conditions:active', condition);
    });
}
function getIDsByCondition(condition) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.getSetMembers(`condition:${condition}:rewards`);
    });
}
function filterCompletedRewards(uid, rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield database_1.default.getSortedSetRangeByScoreWithScores(`uid:${uid}:rewards`, 0, -1, 1, '+inf');
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
    });
}
function getRewardDataByIDs(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.getObjects(ids.map(id => `rewards:id:${id}`));
    });
}
function getRewardsByRewardData(rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.getObjects(rewards.map(reward => `rewards:id:${reward.id}:rewards`));
    });
}
function checkCondition(reward, method) {
    return __awaiter(this, void 0, void 0, function* () {
        if (method.constructor && method.constructor.name !== 'AsyncFunction') {
            method = util.promisify(method);
        }
        const value = yield method();
        const bool = yield plugins.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, { left: value, right: reward.value });
        return bool;
    });
}
function giveRewards(uid, rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        const rewardData = yield getRewardsByRewardData(rewards);
        for (let i = 0; i < rewards.length; i++) {
            /* eslint-disable no-await-in-loop */
            yield plugins.hooks.fire(`action:rewards.award:${rewards[i].rid}`, { uid: uid, reward: rewardData[i] });
            yield database_1.default.sortedSetIncrBy(`uid:${uid}:rewards`, 1, rewards[i].id);
        }
    });
}
require('../promisify').promisify(rewards);
