'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const cacheCreate = require('./cache/lru').default;
console.log(cacheCreate);
exports.default = cacheCreate({
    name: 'local',
    max: 40000,
    ttl: 0,
});
