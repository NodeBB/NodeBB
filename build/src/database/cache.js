'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
function default_1(name) {
    const cacheCreate = require('../cache/lru').default;
    return cacheCreate({
        name: `${name}-object`,
        max: 40000,
        ttl: 0,
    });
}
exports.default = default_1;
;
