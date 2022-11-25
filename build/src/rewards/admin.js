'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugins = require('../plugins');
const database = __importStar(require("../database"));
const db = database;
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
                    data.id = yield db.incrObjectField('global', 'rewards:id');
                }
                yield rewards.delete(data);
                yield db.setAdd('rewards:list', data.id);
                yield db.setObject(`rewards:id:${data.id}`, data);
                yield db.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
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
            db.setRemove('rewards:list', data.id),
            db.delete(`rewards:id:${data.id}`),
            db.delete(`rewards:id:${data.id}:rewards`),
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
        yield db.delete('conditions:active');
        const conditions = [];
        data.forEach((reward) => {
            conditions.push(reward.condition);
            rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
            rewardsPerCondition[reward.condition].push(reward.id);
        });
        yield db.setAdd('conditions:active', conditions);
        yield Promise.all(Object.keys(rewardsPerCondition).map(c => db.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c])));
    });
}
function getActiveRewards() {
    return __awaiter(this, void 0, void 0, function* () {
        function load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                const [main, rewards] = yield Promise.all([
                    db.getObject(`rewards:id:${id}`),
                    db.getObject(`rewards:id:${id}:rewards`),
                ]);
                if (main) {
                    main.disabled = main.disabled === 'true';
                    main.rewards = rewards;
                }
                return main;
            });
        }
        const rewardsList = yield db.getSetMembers('rewards:list');
        const rewardData = yield Promise.all(rewardsList.map(id => load(id)));
        return rewardData.filter(Boolean);
    });
}
require('../promisify').promisify(rewards);
exports.default = rewards;
