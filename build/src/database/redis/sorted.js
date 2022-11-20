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
Object.defineProperty(exports, "__esModule", { value: true });
function default_1(module) {
    const utils = require('../../utils');
    const helpers = require('./helpers').defualt;
    const dbHelpers = require('../helpers').defualt;
    require('./sorted/add').default(module);
    require('./sorted/remove').default(module);
    require('./sorted/union').default(module);
    require('./sorted/intersect').default(module);
    module.getSortedSetRange = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRange('zrange', key, start, stop, '-inf', '+inf', false);
        });
    };
    module.getSortedSetRevRange = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRange('zrevrange', key, start, stop, '-inf', '+inf', false);
        });
    };
    module.getSortedSetRangeWithScores = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRange('zrange', key, start, stop, '-inf', '+inf', true);
        });
    };
    module.getSortedSetRevRangeWithScores = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRange('zrevrange', key, start, stop, '-inf', '+inf', true);
        });
    };
    function sortedSetRange(method, key, start, stop, min, max, withScores) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Array.isArray(key)) {
                if (!key.length) {
                    return [];
                }
                const batch = module.client.batch();
                key.forEach(key => batch[method](genParams(method, key, 0, stop, min, max, true)));
                const data = yield helpers.execBatch(batch);
                const batchData = data.map(setData => helpers.zsetToObjectArray(setData));
                let objects = dbHelpers.mergeBatch(batchData, 0, stop, method === 'zrange' ? 1 : -1);
                if (start > 0) {
                    objects = objects.slice(start, stop !== -1 ? stop + 1 : undefined);
                }
                if (!withScores) {
                    objects = objects.map((item) => item.value);
                }
                return objects;
            }
            const params = genParams(method, key, start, stop, min, max, withScores);
            const data = yield module.client[method](params);
            if (!withScores) {
                return data;
            }
            const objects = helpers.zsetToObjectArray(data);
            return objects;
        });
    }
    function genParams(method, key, start, stop, min, max, withScores) {
        const params = {
            zrevrange: [key, start, stop],
            zrange: [key, start, stop],
            zrangebyscore: [key, min, max],
            zrevrangebyscore: [key, max, min],
        };
        if (withScores) {
            params[method].push('WITHSCORES');
        }
        if (method === 'zrangebyscore' || method === 'zrevrangebyscore') {
            const count = stop !== -1 ? stop - start + 1 : stop;
            params[method].push('LIMIT', start, count);
        }
        return params[method];
    }
    module.getSortedSetRangeByScore = function (key, start, count, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRangeByScore('zrangebyscore', key, start, count, min, max, false);
        });
    };
    module.getSortedSetRevRangeByScore = function (key, start, count, max, min) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRangeByScore('zrevrangebyscore', key, start, count, min, max, false);
        });
    };
    module.getSortedSetRangeByScoreWithScores = function (key, start, count, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRangeByScore('zrangebyscore', key, start, count, min, max, true);
        });
    };
    module.getSortedSetRevRangeByScoreWithScores = function (key, start, count, max, min) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRangeByScore('zrevrangebyscore', key, start, count, min, max, true);
        });
    };
    function sortedSetRangeByScore(method, key, start, count, min, max, withScores) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(count, 10) === 0) {
                return [];
            }
            const stop = (parseInt(count, 10) === -1) ? -1 : (start + count - 1);
            return yield sortedSetRange(method, key, start, stop, min, max, withScores);
        });
    }
    module.sortedSetCount = function (key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.zcount(key, min, max);
        });
    };
    module.sortedSetCard = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.zcard(key);
        });
    };
    module.sortedSetsCard = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const batch = module.client.batch();
            keys.forEach(k => batch.zcard(String(k)));
            return yield helpers.execBatch(batch);
        });
    };
    module.sortedSetsCardSum = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!keys || (Array.isArray(keys) && !keys.length)) {
                return 0;
            }
            if (!Array.isArray(keys)) {
                keys = [keys];
            }
            const counts = yield module.sortedSetsCard(keys);
            const sum = counts.reduce((acc, val) => acc + val, 0);
            return sum;
        });
    };
    module.sortedSetRank = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.zrank(key, value);
        });
    };
    module.sortedSetRevRank = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.zrevrank(key, value);
        });
    };
    module.sortedSetsRanks = function (keys, values) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            for (let i = 0; i < values.length; i += 1) {
                batch.zrank(keys[i], String(values[i]));
            }
            return yield helpers.execBatch(batch);
        });
    };
    module.sortedSetsRevRanks = function (keys, values) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            for (let i = 0; i < values.length; i += 1) {
                batch.zrevrank(keys[i], String(values[i]));
            }
            return yield helpers.execBatch(batch);
        });
    };
    module.sortedSetRanks = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            for (let i = 0; i < values.length; i += 1) {
                batch.zrank(key, String(values[i]));
            }
            return yield helpers.execBatch(batch);
        });
    };
    module.sortedSetRevRanks = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            for (let i = 0; i < values.length; i += 1) {
                batch.zrevrank(key, String(values[i]));
            }
            return yield helpers.execBatch(batch);
        });
    };
    module.sortedSetScore = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key || value === undefined) {
                return null;
            }
            const score = yield module.client.zscore(key, value);
            return score === null ? score : parseFloat(score);
        });
    };
    module.sortedSetsScore = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const batch = module.client.batch();
            keys.forEach(key => batch.zscore(String(key), String(value)));
            const scores = yield helpers.execBatch(batch);
            return scores.map((d) => (d === null ? d : parseFloat(d)));
        });
    };
    module.sortedSetScores = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!values.length) {
                return [];
            }
            const batch = module.client.batch();
            values.forEach(value => batch.zscore(String(key), String(value)));
            const scores = yield helpers.execBatch(batch);
            return scores.map((d) => (d === null ? d : parseFloat(d)));
        });
    };
    module.isSortedSetMember = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const score = yield module.sortedSetScore(key, value);
            return utils.isNumber(score);
        });
    };
    module.isSortedSetMembers = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!values.length) {
                return [];
            }
            const batch = module.client.batch();
            values.forEach(v => batch.zscore(key, String(v)));
            const results = yield helpers.execBatch(batch);
            return results.map(utils.isNumber);
        });
    };
    module.isMemberOfSortedSets = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const batch = module.client.batch();
            keys.forEach(k => batch.zscore(k, String(value)));
            const results = yield helpers.execBatch(batch);
            return results.map(utils.isNumber);
        });
    };
    module.getSortedSetMembers = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.zrange(key, 0, -1);
        });
    };
    module.getSortedSetsMembers = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const batch = module.client.batch();
            keys.forEach(k => batch.zrange(k, 0, -1));
            return yield helpers.execBatch(batch);
        });
    };
    module.sortedSetIncrBy = function (key, increment, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const newValue = yield module.client.zincrby(key, increment, value);
            return parseFloat(newValue);
        });
    };
    module.sortedSetIncrByBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const multi = module.client.multi();
            data.forEach((item) => {
                multi.zincrby(item[0], item[1], item[2]);
            });
            const result = yield multi.exec();
            return result.map((item) => item && parseFloat(item[1]));
        });
    };
    module.getSortedSetRangeByLex = function (key, min, max, start, count) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetLex('zrangebylex', false, key, min, max, start, count);
        });
    };
    module.getSortedSetRevRangeByLex = function (key, max, min, start, count) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetLex('zrevrangebylex', true, key, max, min, start, count);
        });
    };
    module.sortedSetRemoveRangeByLex = function (key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sortedSetLex('zremrangebylex', false, key, min, max);
        });
    };
    module.sortedSetLexCount = function (key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetLex('zlexcount', false, key, min, max);
        });
    };
    function sortedSetLex(method, reverse, key, min, max, start, count) {
        return __awaiter(this, void 0, void 0, function* () {
            let minmin;
            let maxmax;
            if (reverse) {
                minmin = '+';
                maxmax = '-';
            }
            else {
                minmin = '-';
                maxmax = '+';
            }
            if (min !== minmin && !min.match(/^[[(]/)) {
                min = `[${min}`;
            }
            if (max !== maxmax && !max.match(/^[[(]/)) {
                max = `[${max}`;
            }
            const args = [key, min, max];
            if (count) {
                args.push('LIMIT', start, count);
            }
            return yield module.client[method](args);
        });
    }
    module.getSortedSetScan = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            let cursor = '0';
            const returnData = [];
            let done = false;
            const seen = {};
            do {
                /* eslint-disable no-await-in-loop */
                const res = yield module.client.zscan(params.key, cursor, 'MATCH', params.match, 'COUNT', 5000);
                cursor = res[0];
                done = cursor === '0';
                const data = res[1];
                for (let i = 0; i < data.length; i += 2) {
                    const value = data[i];
                    if (!seen[value]) {
                        seen[value] = 1;
                        if (params.withScores) {
                            returnData.push({ value: value, score: parseFloat(data[i + 1]) });
                        }
                        else {
                            returnData.push(value);
                        }
                        if (params.limit && returnData.length >= params.limit) {
                            done = true;
                            break;
                        }
                    }
                }
            } while (!done);
            return returnData;
        });
    };
}
exports.default = default_1;
;
