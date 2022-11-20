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
    const helpers = require('./helpers').defualt;
    module.listPrepend = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            value = Array.isArray(value) ? value : [value];
            value.reverse();
            const exists = yield module.isObjectField(key, 'array');
            if (exists) {
                yield listPush(key, value, { $position: 0 });
            }
            else {
                yield module.listAppend(key, value);
            }
        });
    };
    module.listAppend = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            value = Array.isArray(value) ? value : [value];
            yield listPush(key, value);
        });
    };
    function listPush(key, values, position) {
        return __awaiter(this, void 0, void 0, function* () {
            values = values.map(helpers.valueToString);
            yield module.client.collection('objects').updateOne({
                _key: key,
            }, {
                $push: {
                    array: Object.assign({ $each: values }, (position || {})),
                },
            }, {
                upsert: true,
            });
        });
    }
    module.listRemoveLast = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const value = yield module.getListRange(key, -1, -1);
            module.client.collection('objects').updateOne({ _key: key }, { $pop: { array: 1 } });
            return (value && value.length) ? value[0] : null;
        });
    };
    module.listRemoveAll = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const isArray = Array.isArray(value);
            if (isArray) {
                value = value.map(helpers.valueToString);
            }
            else {
                value = helpers.valueToString(value);
            }
            yield module.client.collection('objects').updateOne({
                _key: key,
            }, {
                $pull: { array: isArray ? { $in: value } : value },
            });
        });
    };
    module.listTrim = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const value = yield module.getListRange(key, start, stop);
            yield module.client.collection('objects').updateOne({ _key: key }, { $set: { array: value } });
        });
    };
    module.getListRange = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const data = yield module.client.collection('objects').findOne({ _key: key }, { array: 1 });
            if (!(data && data.array)) {
                return [];
            }
            return data.array.slice(start, stop !== -1 ? stop + 1 : undefined);
        });
    };
    module.listLength = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield module.client.collection('objects').aggregate([
                { $match: { _key: key } },
                { $project: { count: { $size: '$array' } } },
            ]).toArray();
            return Array.isArray(result) && result.length && result[0].count;
        });
    };
}
exports.default = default_1;
;
