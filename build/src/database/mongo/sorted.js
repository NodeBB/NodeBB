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
const _ = require('lodash');
const utils = require('../../utils');
function default_1(module) {
    const helpers = require('./helpers').default;
    const dbHelpers = require('../helpers').default;
    const util = require('util');
    const sleep = util.promisify(setTimeout);
    require('./sorted/add').default(module);
    require('./sorted/remove').default(module);
    require('./sorted/union').default(module);
    require('./sorted/intersect').default(module);
    module.getSortedSetRange = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRange(key, start, stop, '-inf', '+inf', 1, false);
        });
    };
    module.getSortedSetRevRange = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRange(key, start, stop, '-inf', '+inf', -1, false);
        });
    };
    module.getSortedSetRangeWithScores = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRange(key, start, stop, '-inf', '+inf', 1, true);
        });
    };
    module.getSortedSetRevRangeWithScores = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRange(key, start, stop, '-inf', '+inf', -1, true);
        });
    };
    function getSortedSetRange(key, start, stop, min, max, sort, withScores) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const isArray = Array.isArray(key);
            if ((start < 0 && start > stop) || (isArray && !key.length)) {
                return [];
            }
            const query = { _key: key };
            if (isArray) {
                if (key.length > 1) {
                    query._key = { $in: key };
                }
                else {
                    query._key = key[0];
                }
            }
            if (min !== '-inf') {
                query.score = { $gte: min };
            }
            if (max !== '+inf') {
                query.score = query.score || {};
                query.score.$lte = max;
            }
            if (max === min) {
                query.score = max;
            }
            const fields = { _id: 0, _key: 0 };
            if (!withScores) {
                fields.score = 0;
            }
            let reverse = false;
            if (start === 0 && stop < -1) {
                reverse = true;
                sort *= -1;
                start = Math.abs(stop + 1);
                stop = -1;
            }
            else if (start < 0 && stop > start) {
                const tmp1 = Math.abs(stop + 1);
                stop = Math.abs(start + 1);
                start = tmp1;
            }
            let limit = stop - start + 1;
            if (limit <= 0) {
                limit = 0;
            }
            let result = [];
            function doQuery(_key, fields, skip, limit) {
                return __awaiter(this, void 0, void 0, function* () {
                    return yield module.client.collection('objects').find(Object.assign(Object.assign({}, query), { _key: _key }), { projection: fields })
                        .sort({ score: sort })
                        .skip(skip)
                        .limit(limit)
                        .toArray();
                });
            }
            if (isArray && key.length > 100) {
                const batches = [];
                const batch = require('../../batch');
                const batchSize = Math.ceil(key.length / Math.ceil(key.length / 100));
                yield batch.processArray(key, (currentBatch) => __awaiter(this, void 0, void 0, function* () { return batches.push(currentBatch); }), { batch: batchSize });
                const batchData = yield Promise.all(batches.map((batch) => doQuery({ $in: batch }, { _id: 0, _key: 0 }, 0, stop + 1)));
                result = dbHelpers.mergeBatch(batchData, 0, stop, sort);
                if (start > 0) {
                    result = result.slice(start, stop !== -1 ? stop + 1 : undefined);
                }
            }
            else {
                result = yield doQuery(query._key, fields, start, limit);
            }
            if (reverse) {
                result.reverse();
            }
            if (!withScores) {
                result = result.map((item) => item.value);
            }
            return result;
        });
    }
    module.getSortedSetRangeByScore = function (key, start, count, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRangeByScore(key, start, count, min, max, 1, false);
        });
    };
    module.getSortedSetRevRangeByScore = function (key, start, count, max, min) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRangeByScore(key, start, count, min, max, -1, false);
        });
    };
    module.getSortedSetRangeByScoreWithScores = function (key, start, count, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRangeByScore(key, start, count, min, max, 1, true);
        });
    };
    module.getSortedSetRevRangeByScoreWithScores = function (key, start, count, max, min) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRangeByScore(key, start, count, min, max, -1, true);
        });
    };
    function getSortedSetRangeByScore(key, start, count, min, max, sort, withScores) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(count, 10) === 0) {
                return [];
            }
            const stop = (parseInt(count, 10) === -1) ? -1 : (start + count - 1);
            return yield getSortedSetRange(key, start, stop, min, max, sort, withScores);
        });
    }
    module.sortedSetCount = function (key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const query = { _key: key };
            if (min !== '-inf') {
                query.score = { $gte: min };
            }
            if (max !== '+inf') {
                query.score = query.score || {};
                query.score.$lte = max;
            }
            const count = yield module.client.collection('objects').countDocuments(query);
            return count || 0;
        });
    };
    module.sortedSetCard = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return 0;
            }
            const count = yield module.client.collection('objects').countDocuments({ _key: key });
            return parseInt(count, 10) || 0;
        });
    };
    module.sortedSetsCard = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const promises = keys.map(k => module.sortedSetCard(k));
            return yield Promise.all(promises);
        });
    };
    module.sortedSetsCardSum = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!keys || (Array.isArray(keys) && !keys.length)) {
                return 0;
            }
            const count = yield module.client.collection('objects').countDocuments({ _key: Array.isArray(keys) ? { $in: keys } : keys });
            return parseInt(count, 10) || 0;
        });
    };
    module.sortedSetRank = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRank(false, key, value);
        });
    };
    module.sortedSetRevRank = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getSortedSetRank(true, key, value);
        });
    };
    function getSortedSetRank(reverse, key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            value = helpers.valueToString(value);
            const score = yield module.sortedSetScore(key, value);
            if (score === null) {
                return null;
            }
            return yield module.client.collection('objects').countDocuments({
                $or: [
                    {
                        _key: key,
                        score: reverse ? { $gt: score } : { $lt: score },
                    },
                    {
                        _key: key,
                        score: score,
                        value: reverse ? { $gt: value } : { $lt: value },
                    },
                ],
            });
        });
    }
    module.sortedSetsRanks = function (keys, values) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetsRanks(module.sortedSetRank, keys, values);
        });
    };
    module.sortedSetsRevRanks = function (keys, values) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetsRanks(module.sortedSetRevRank, keys, values);
        });
    };
    function sortedSetsRanks(method, keys, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const data = new Array(values.length);
            for (let i = 0; i < values.length; i += 1) {
                data[i] = { key: keys[i], value: values[i] };
            }
            const promises = data.map((item) => method(item.key, item.value));
            return yield Promise.all(promises);
        });
    }
    function sortedSetRanks(reverse, key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (values.length === 1) {
                return [yield getSortedSetRank(reverse, key, values[0])];
            }
            const sortedSet = yield module[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](key, 0, -1);
            return values.map((value) => {
                if (!value) {
                    return null;
                }
                const index = sortedSet.indexOf(value.toString());
                return index !== -1 ? index : null;
            });
        });
    }
    module.sortedSetRanks = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRanks(false, key, values);
        });
    };
    module.sortedSetRevRanks = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetRanks(true, key, values);
        });
    };
    module.sortedSetScore = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            value = helpers.valueToString(value);
            const result = yield module.client.collection('objects').findOne({ _key: key, value: value }, { projection: { _id: 0, _key: 0, value: 0 } });
            return result ? result.score : null;
        });
    };
    module.sortedSetsScore = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            value = helpers.valueToString(value);
            const result = yield module.client.collection('objects').find({ _key: { $in: keys }, value: value }, { projection: { _id: 0, value: 0 } }).toArray();
            const map = {};
            result.forEach((item) => {
                if (item) {
                    map[item._key] = item;
                }
            });
            return keys.map(key => (map[key] ? map[key].score : null));
        });
    };
    module.sortedSetScores = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            if (!values.length) {
                return [];
            }
            values = values.map(helpers.valueToString);
            const result = yield module.client.collection('objects').find({ _key: key, value: { $in: values } }, { projection: { _id: 0, _key: 0 } }).toArray();
            const valueToScore = {};
            result.forEach((item) => {
                if (item) {
                    valueToScore[item.value] = item.score;
                }
            });
            return values.map(v => (utils.isNumber(valueToScore[v]) ? valueToScore[v] : null));
        });
    };
    module.isSortedSetMember = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            value = helpers.valueToString(value);
            const result = yield module.client.collection('objects').findOne({
                _key: key, value: value,
            }, {
                projection: { _id: 0, value: 1 },
            });
            return !!result;
        });
    };
    module.isSortedSetMembers = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            if (!values.length) {
                return [];
            }
            values = values.map(helpers.valueToString);
            const results = yield module.client.collection('objects').find({
                _key: key, value: { $in: values },
            }, {
                projection: { _id: 0, value: 1 },
            }).toArray();
            const isMember = {};
            results.forEach((item) => {
                if (item) {
                    isMember[item.value] = true;
                }
            });
            return values.map(value => !!isMember[value]);
        });
    };
    module.isMemberOfSortedSets = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            value = helpers.valueToString(value);
            const results = yield module.client.collection('objects').find({
                _key: { $in: keys }, value: value,
            }, {
                projection: { _id: 0, _key: 1, value: 1 },
            }).toArray();
            const isMember = {};
            results.forEach((item) => {
                if (item) {
                    isMember[item._key] = true;
                }
            });
            return keys.map(key => !!isMember[key]);
        });
    };
    module.getSortedSetMembers = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield module.getSortedSetsMembers([key]);
            return data && data[0];
        });
    };
    module.getSortedSetsMembers = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const arrayOfKeys = keys.length > 1;
            const projection = { _id: 0, value: 1 };
            if (arrayOfKeys) {
                projection._key = 1;
            }
            const data = yield module.client.collection('objects').find({
                _key: arrayOfKeys ? { $in: keys } : keys[0],
            }, { projection: projection }).toArray();
            if (!arrayOfKeys) {
                return [data.map((item) => item.value)];
            }
            const sets = {};
            data.forEach((item) => {
                sets[item._key] = sets[item._key] || [];
                sets[item._key].push(item.value);
            });
            return keys.map(k => sets[k] || []);
        });
    };
    module.sortedSetIncrBy = function (key, increment, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const data = {};
            value = helpers.valueToString(value);
            data.score = parseFloat(increment);
            try {
                const result = yield module.client.collection('objects').findOneAndUpdate({
                    _key: key,
                    value: value,
                }, {
                    $inc: data,
                }, {
                    returnDocument: 'after',
                    upsert: true,
                });
                return result && result.value ? result.value.score : null;
            }
            catch (err) {
                // if there is duplicate key error retry the upsert
                // https://github.com/NodeBB/NodeBB/issues/4467
                // https://jira.mongodb.org/browse/SERVER-14322
                // https://docs.mongodb.org/manual/reference/command/findAndModify/#upsert-and-unique-index
                if (err && err.message.startsWith('E11000 duplicate key error')) {
                    return yield module.sortedSetIncrBy(key, increment, value);
                }
                throw err;
            }
        });
    };
    module.sortedSetIncrByBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
            data.forEach((item) => {
                bulk.find({ _key: item[0], value: helpers.valueToString(item[2]) })
                    .upsert()
                    .update({ $inc: { score: parseFloat(item[1]) } });
            });
            yield bulk.execute();
            const result = yield module.client.collection('objects').find({
                _key: { $in: _.uniq(data.map((i) => i[0])) },
                value: { $in: _.uniq(data.map((i) => i[2])) },
            }, {
                projection: { _id: 0, _key: 1, value: 1, score: 1 },
            }).toArray();
            const map = {};
            result.forEach((item) => {
                map[`${item._key}:${item.value}`] = item.score;
            });
            return data.map((item) => map[`${item[0]}:${item[2]}`]);
        });
    };
    module.getSortedSetRangeByLex = function (key, min, max, start, count) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetLex(key, min, max, 1, start, count);
        });
    };
    module.getSortedSetRevRangeByLex = function (key, max, min, start, count) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sortedSetLex(key, min, max, -1, start, count);
        });
    };
    module.sortedSetLexCount = function (key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield sortedSetLex(key, min, max, 1, 0, 0);
            return data ? data.length : null;
        });
    };
    function sortedSetLex(key, min, max, sort, start, count) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { _key: key };
            start = start !== undefined ? start : 0;
            count = count !== undefined ? count : 0;
            buildLexQuery(query, min, max);
            const data = yield module.client.collection('objects').find(query, { projection: { _id: 0, value: 1 } })
                .sort({ value: sort })
                .skip(start)
                .limit(count === -1 ? 0 : count)
                .toArray();
            return data.map((item) => item && item.value);
        });
    }
    module.sortedSetRemoveRangeByLex = function (key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { _key: key };
            buildLexQuery(query, min, max);
            yield module.client.collection('objects').deleteMany(query);
        });
    };
    function buildLexQuery(query, min, max) {
        if (min !== '-') {
            if (min.match(/^\(/)) {
                query.value = { $gt: min.slice(1) };
            }
            else if (min.match(/^\[/)) {
                query.value = { $gte: min.slice(1) };
            }
            else {
                query.value = { $gte: min };
            }
        }
        if (max !== '+') {
            query.value = query.value || {};
            if (max.match(/^\(/)) {
                query.value.$lt = max.slice(1);
            }
            else if (max.match(/^\[/)) {
                query.value.$lte = max.slice(1);
            }
            else {
                query.value.$lte = max;
            }
        }
    }
    module.getSortedSetScan = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            const project = { _id: 0, value: 1 };
            if (params.withScores) {
                project.score = 1;
            }
            const match = helpers.buildMatchQuery(params.match);
            let regex;
            try {
                regex = new RegExp(match);
            }
            catch (err) {
                return [];
            }
            const cursor = module.client.collection('objects').find({
                _key: params.key, value: { $regex: regex },
            }, { projection: project });
            if (params.limit) {
                cursor.limit(params.limit);
            }
            const data = yield cursor.toArray();
            if (!params.withScores) {
                return data.map((d) => d.value);
            }
            return data;
        });
    };
    module.processSortedSet = function (setKey, processFn, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let done = false;
            const ids = [];
            const project = { _id: 0, _key: 0 };
            if (!options.withScores) {
                project.score = 0;
            }
            const cursor = yield module.client.collection('objects').find({ _key: setKey }, { projection: project })
                .sort({ score: 1 })
                .batchSize(options.batch);
            if (processFn && processFn.constructor && processFn.constructor.name !== 'AsyncFunction') {
                processFn = util.promisify(processFn);
            }
            while (!done) {
                /* eslint-disable no-await-in-loop */
                const item = yield cursor.next();
                if (item === null) {
                    done = true;
                }
                else {
                    ids.push(options.withScores ? item : item.value);
                }
                if (ids.length >= options.batch || (done && ids.length !== 0)) {
                    yield processFn(ids);
                    ids.length = 0;
                    if (options.interval) {
                        yield sleep(options.interval);
                    }
                }
            }
        });
    };
}
exports.default = default_1;
;
