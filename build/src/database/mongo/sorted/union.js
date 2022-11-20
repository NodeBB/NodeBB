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
    module.sortedSetUnionCard = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return 0;
            }
            const data = yield module.client.collection('objects').aggregate([
                { $match: { _key: { $in: keys } } },
                { $group: { _id: { value: '$value' } } },
                { $group: { _id: null, count: { $sum: 1 } } },
            ]).toArray();
            return Array.isArray(data) && data.length ? data[0].count : 0;
        });
    };
    module.getSortedSetUnion = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            params.sort = 1;
            return yield getSortedSetUnion(params);
        });
    };
    module.getSortedSetRevUnion = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            params.sort = -1;
            return yield getSortedSetUnion(params);
        });
    };
    function getSortedSetUnion(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(params.sets) || !params.sets.length) {
                return;
            }
            let limit = params.stop - params.start + 1;
            if (limit <= 0) {
                limit = 0;
            }
            const aggregate = {};
            if (params.aggregate) {
                aggregate[`$${params.aggregate.toLowerCase()}`] = '$score';
            }
            else {
                aggregate.$sum = '$score';
            }
            const pipeline = [
                { $match: { _key: { $in: params.sets } } },
                { $group: { _id: { value: '$value' }, totalScore: aggregate } },
                { $sort: { totalScore: params.sort } },
            ];
            if (params.start) {
                pipeline.push({ $skip: params.start });
            }
            if (limit > 0) {
                pipeline.push({ $limit: limit });
            }
            const project = { _id: 0, value: '$_id.value' };
            if (params.withScores) {
                project.score = '$totalScore';
            }
            pipeline.push({ $project: project });
            let data = yield module.client.collection('objects').aggregate(pipeline).toArray();
            if (!params.withScores) {
                data = data.map((item) => item.value);
            }
            return data;
        });
    }
}
exports.default = default_1;
;
