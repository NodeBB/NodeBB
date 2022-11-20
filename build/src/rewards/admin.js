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
const plugins = require('../plugins');
const database_1 = __importDefault(require("../database"));
const utils = require('../utils');
const rewards = {};
rewards.save = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        function save(data) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!Object.keys(data.rewards).length) {
                    return;
                }
                const rewardsData = data.rewards;
                delete data.rewards;
                if (!parseInt(data.id, 10)) {
                    data.id = yield database_1.default.incrObjectField('global', 'rewards:id');
                }
                yield rewards.delete(data);
                yield database_1.default.setAdd('rewards:list', data.id);
                yield database_1.default.setObject(`rewards:id:${data.id}`, data);
                yield database_1.default.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
            });
        }
        yield Promise.all(data.map(data => save(data)));
        yield saveConditions(data);
        return data;
    });
};
rewards.delete = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            database_1.default.setRemove('rewards:list', data.id),
            database_1.default.delete(`rewards:id:${data.id}`),
            database_1.default.delete(`rewards:id:${data.id}:rewards`),
        ]);
    });
};
rewards.get = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            active: getActiveRewards(),
            conditions: plugins.hooks.fire('filter:rewards.conditions', []),
            conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
            rewards: plugins.hooks.fire('filter:rewards.rewards', []),
        });
    });
};
function saveConditions(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const rewardsPerCondition = {};
        yield database_1.default.delete('conditions:active');
        const conditions = [];
        data.forEach((reward) => {
            conditions.push(reward.condition);
            rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
            rewardsPerCondition[reward.condition].push(reward.id);
        });
        yield database_1.default.setAdd('conditions:active', conditions);
        yield Promise.all(Object.keys(rewardsPerCondition).map(c => database_1.default.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c])));
    });
}
function getActiveRewards() {
    return __awaiter(this, void 0, void 0, function* () {
        function load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                const [main, rewards] = yield Promise.all([
                    database_1.default.getObject(`rewards:id:${id}`),
                    database_1.default.getObject(`rewards:id:${id}:rewards`),
                ]);
                if (main) {
                    main.disabled = main.disabled === 'true';
                    main.rewards = rewards;
                }
                return main;
            });
        }
        const rewardsList = yield database_1.default.getSetMembers('rewards:list');
        const rewardData = yield Promise.all(rewardsList.map(id => load(id)));
        return rewardData.filter(Boolean);
    });
}
require('../promisify').promisify(rewards);
exports.default = rewards;
