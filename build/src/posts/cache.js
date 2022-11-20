'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cacheCreate = require('../cache/lru').default;
console.log('CACHE CREATE', cacheCreate);
const meta_1 = __importDefault(require("../meta"));
exports.default = cacheCreate({
    name: 'post',
    maxSize: meta_1.default.config.postCacheSize,
    sizeCalculation: function (n) { return n.length || 1; },
    ttl: 0,
    enabled: global.env === 'production',
});
