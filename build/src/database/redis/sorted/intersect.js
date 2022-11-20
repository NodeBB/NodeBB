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
const helpers_1 = __importDefault(require("../helpers"));
function default_1(module) {
    module.sortedSetIntersectCard = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return 0;
            }
            const tempSetName = `temp_${Date.now()}`;
            const interParams = [tempSetName, keys.length].concat(keys);
            const multi = module.client.multi();
            multi.zinterstore(interParams);
            multi.zcard(tempSetName);
            multi.del(tempSetName);
            const results = yield helpers_1.default.execBatch(multi);
            return results[1] || 0;
        });
    };
    module.getSortedSetIntersect = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            params.method = 'zrange';
            return yield getSortedSetRevIntersect(params);
        });
    };
    module.getSortedSetRevIntersect = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            params.method = 'zrevrange';
            return yield getSortedSetRevIntersect(params);
        });
    };
    function getSortedSetRevIntersect(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sets } = params;
            const start = params.hasOwnProperty('start') ? params.start : 0;
            const stop = params.hasOwnProperty('stop') ? params.stop : -1;
            const weights = params.weights || [];
            const tempSetName = `temp_${Date.now()}`;
            let interParams = [tempSetName, sets.length].concat(sets);
            if (weights.length) {
                interParams = interParams.concat(['WEIGHTS'].concat(weights));
            }
            if (params.aggregate) {
                interParams = interParams.concat(['AGGREGATE', params.aggregate]);
            }
            const rangeParams = [tempSetName, start, stop];
            if (params.withScores) {
                rangeParams.push('WITHSCORES');
            }
            const multi = module.client.multi();
            multi.zinterstore(interParams);
            multi[params.method](rangeParams);
            multi.del(tempSetName);
            let results = yield helpers_1.default.execBatch(multi);
            if (!params.withScores) {
                return results ? results[1] : null;
            }
            results = results[1] || [];
            return helpers_1.default.zsetToObjectArray(results);
        });
    }
}
exports.default = default_1;
;
