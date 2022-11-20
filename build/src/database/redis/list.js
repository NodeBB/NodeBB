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
            yield module.client.lpush(key, value);
        });
    };
    module.listAppend = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.client.rpush(key, value);
        });
    };
    module.listRemoveLast = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            return yield module.client.rpop(key);
        });
    };
    module.listRemoveAll = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            if (Array.isArray(value)) {
                const batch = module.client.batch();
                value.forEach(value => batch.lrem(key, 0, value));
                yield helpers.execBatch(batch);
            }
            else {
                yield module.client.lrem(key, 0, value);
            }
        });
    };
    module.listTrim = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.client.ltrim(key, start, stop);
        });
    };
    module.getListRange = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            return yield module.client.lrange(key, start, stop);
        });
    };
    module.listLength = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.llen(key);
        });
    };
}
exports.default = default_1;
;
