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
const helpers = {};
helpers.noop = function () { };
helpers.execBatch = function (batch) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield batch.exec();
        return results.map(([err, res]) => {
            if (err) {
                throw err;
            }
            return res;
        });
    });
};
helpers.resultsToBool = function (results) {
    for (let i = 0; i < results.length; i += 1) {
        results[i] = results[i] === 1;
    }
    return results;
};
helpers.zsetToObjectArray = function (data) {
    const objects = new Array(data.length / 2);
    for (let i = 0, k = 0; i < objects.length; i += 1, k += 2) {
        objects[i] = { value: data[k], score: parseFloat(data[k + 1]) };
    }
    return objects;
};
exports.default = helpers;
