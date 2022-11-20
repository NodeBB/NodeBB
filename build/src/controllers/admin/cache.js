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
const cacheController = {};
const utils = require("../../utils");
const plugins = require('../../plugins');
cacheController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const postCache = require('../../posts/cache');
        const groupCache = require('../../groups').cache;
        const { objectCache } = require('../../database');
        const localCache = require('../../cache');
        function getInfo(cache) {
            return {
                length: cache.length,
                max: cache.max,
                maxSize: cache.maxSize,
                itemCount: cache.itemCount,
                percentFull: cache.name === 'post' ?
                    ((cache.length / cache.maxSize) * 100).toFixed(2) :
                    ((cache.itemCount / cache.max) * 100).toFixed(2),
                // @ts-ignore
                hits: utils.addCommas(String(cache.hits)),
                // @ts-ignore
                misses: utils.addCommas(String(cache.misses)),
                hitRatio: ((cache.hits / (cache.hits + cache.misses) || 0)).toFixed(4),
                enabled: cache.enabled,
                ttl: cache.ttl,
            };
        }
        let caches = {
            post: postCache,
            group: groupCache,
            local: localCache,
        };
        if (objectCache) {
            caches.object = objectCache;
        }
        caches = yield plugins.hooks.fire('filter:admin.cache.get', caches);
        for (const [key, value] of Object.entries(caches)) {
            caches[key] = getInfo(value);
        }
        res.render('admin/advanced/cache', { caches });
    });
};
cacheController.dump = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let caches = {
            post: require('../../posts/cache'),
            object: require('../../database').objectCache,
            group: require('../../groups').cache,
            local: require('../../cache'),
        };
        caches = yield plugins.hooks.fire('filter:admin.cache.get', caches);
        // @ts-ignore
        if (!caches[req.query.name]) {
            return next();
        }
        // @ts-ignore
        const data = JSON.stringify(caches[req.query.name].dump(), null, 4);
        res.setHeader('Content-disposition', `attachment; filename= ${req.query.name}-cache.json`);
        res.setHeader('Content-type', 'application/json');
        res.write(data, (err) => {
            if (err) {
                return next(err);
            }
            res.end();
        });
    });
};
