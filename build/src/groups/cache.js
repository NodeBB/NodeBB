'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const cacheCreate = require('../cache/lru').default;
function default_1(Groups) {
    Groups.cache = cacheCreate({
        name: 'group',
        max: 40000,
        ttl: 0,
    });
    Groups.clearCache = function (uid, groupNames) {
        if (!Array.isArray(groupNames)) {
            groupNames = [groupNames];
        }
        const keys = groupNames.map(name => `${uid}:${name}`);
        Groups.cache.del(keys);
    };
}
exports.default = default_1;
;
