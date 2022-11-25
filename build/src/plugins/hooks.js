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
const util = require('util');
const winston_1 = __importDefault(require("winston"));
const _1 = __importDefault(require("."));
const utils_1 = __importDefault(require("../utils"));
const als_1 = __importDefault(require("../als"));
const Hooks = {};
Hooks._deprecated = new Map([
    ['filter:email.send', {
            new: 'static:email.send',
            since: 'v1.17.0',
            until: 'v2.0.0',
        }],
    ['filter:router.page', {
            new: 'response:router.page',
            since: 'v1.15.3',
            until: 'v2.1.0',
        }],
    ['filter:post.purge', {
            new: 'filter:posts.purge',
            since: 'v1.19.6',
            until: 'v2.1.0',
        }],
    ['action:post.purge', {
            new: 'action:posts.purge',
            since: 'v1.19.6',
            until: 'v2.1.0',
        }],
    ['filter:user.verify.code', {
            new: 'filter:user.verify',
            since: 'v2.2.0',
            until: 'v3.0.0',
        }],
]);
Hooks.internals = {
    _register: function (data) {
        _1.default.loadedHooks[data.hook] = _1.default.loadedHooks[data.hook] || [];
        _1.default.loadedHooks[data.hook].push(data);
    },
};
const hookTypeToMethod = {
    filter: fireFilterHook,
    action: fireActionHook,
    static: fireStaticHook,
    response: fireResponseHook,
};
/*
    `data` is an object consisting of (* is required):
        `data.hook`*, the name of the NodeBB hook
        `data.method`*, the method called in that plugin (can be an array of functions)
        `data.priority`, the relative priority of the method when it is eventually called (default: 10)
*/
Hooks.register = function (id, data) {
    if (!data.hook || !data.method) {
        winston_1.default.warn(`[plugins/${id}] registerHook called with invalid data.hook/method`, data);
        return;
    }
    // `hasOwnProperty` needed for hooks with no alternative (set to null)
    if (Hooks._deprecated.has(data.hook)) {
        const deprecation = Hooks._deprecated.get(data.hook);
        if (!deprecation.hasOwnProperty('affected')) {
            deprecation.affected = new Set();
        }
        deprecation.affected.add(id);
        Hooks._deprecated.set(data.hook, deprecation);
    }
    data.id = id;
    if (!data.priority) {
        data.priority = 10;
    }
    if (Array.isArray(data.method) && data.method.every(method => typeof method === 'function' || typeof method === 'string')) {
        // Go go gadget recursion!
        data.method.forEach((method) => {
            const singularData = Object.assign(Object.assign({}, data), { method: method });
            Hooks.register(id, singularData);
        });
    }
    else if (typeof data.method === 'string' && data.method.length > 0) {
        const method = data.method.split('.').reduce((memo, prop) => {
            if (memo && memo[prop]) {
                return memo[prop];
            }
            // Couldn't find method by path, aborting
            return null;
        }, _1.default.libraries[data.id]);
        // Write the actual method reference to the hookObj
        data.method = method;
        Hooks.internals._register(data);
    }
    else if (typeof data.method === 'function') {
        Hooks.internals._register(data);
    }
    else {
        winston_1.default.warn(`[plugins/${id}] Hook method mismatch: ${data.hook} => ${data.method}`);
    }
};
Hooks.unregister = function (id, hook, method) {
    const hooks = _1.default.loadedHooks[hook] || [];
    _1.default.loadedHooks[hook] = hooks.filter(hookData => hookData && hookData.id !== id && hookData.method !== method);
};
Hooks.fire = function (hook, params) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('HOOK', hook);
        console.log('PARAMS', params);
        const hookList = _1.default.loadedHooks[hook];
        const hookType = hook.split(':')[0];
        if (global.env === 'development' && hook !== 'action:plugins.firehook' && hook !== 'filter:plugins.firehook') {
            winston_1.default.verbose(`[plugins/fireHook] ${hook}`);
        }
        if (!hookTypeToMethod[hookType]) {
            winston_1.default.warn(`[plugins] Unknown hookType: ${hookType}, hook : ${hook}`);
            return;
        }
        let deleteCaller = false;
        if (params && typeof params === 'object' && !Array.isArray(params) && !params.hasOwnProperty('caller')) {
            params.caller = als_1.default.getStore();
            deleteCaller = true;
        }
        console.log('HOOK TYPE TO METHOD', hookTypeToMethod);
        const result = yield hookTypeToMethod[hookType](hook, hookList, params);
        if (hook !== 'action:plugins.firehook' && hook !== 'filter:plugins.firehook') {
            const payload = yield Hooks.fire('filter:plugins.firehook', { hook: hook, params: result || params });
            Hooks.fire('action:plugins.firehook', payload);
        }
        if (result !== undefined) {
            if (deleteCaller && result && result.hasOwnProperty('caller')) {
                delete result.caller;
            }
            return result;
        }
    });
};
Hooks.hasListeners = function (hook) {
    return !!(_1.default.loadedHooks[hook] && _1.default.loadedHooks[hook].length > 0);
};
function fireFilterHook(hook, hookList, params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(hookList) || !hookList.length) {
            return params;
        }
        function fireMethod(hookObj, params) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof hookObj.method !== 'function') {
                    if (global.env === 'development') {
                        winston_1.default.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
                    }
                    return params;
                }
                if (hookObj.method.constructor && hookObj.method.constructor.name === 'AsyncFunction') {
                    return yield hookObj.method(params);
                }
                return new Promise((resolve, reject) => {
                    let resolved = false;
                    function _resolve(result) {
                        if (resolved) {
                            winston_1.default.warn(`[plugins] ${hook} already resolved in plugin ${hookObj.id}`);
                            return;
                        }
                        resolved = true;
                        resolve(result);
                    }
                    const returned = hookObj.method(params, (err, result) => {
                        if (err)
                            reject(err);
                        else
                            _resolve(result);
                    });
                    if (utils_1.default.isPromise(returned)) {
                        returned.then(payload => _resolve(payload), err => reject(err));
                        return;
                    }
                    if (returned) {
                        _resolve(returned);
                    }
                });
            });
        }
        for (const hookObj of hookList) {
            // eslint-disable-next-line
            params = yield fireMethod(hookObj, params);
        }
        return params;
    });
}
function fireActionHook(hook, hookList, params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(hookList) || !hookList.length) {
            return;
        }
        for (const hookObj of hookList) {
            if (typeof hookObj.method !== 'function') {
                if (global.env === 'development') {
                    winston_1.default.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
                }
            }
            else {
                // eslint-disable-next-line
                yield hookObj.method(params);
            }
        }
    });
}
function fireStaticHook(hook, hookList, params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(hookList) || !hookList.length) {
            return;
        }
        // don't bubble errors from these hooks, so bad plugins don't stop startup
        const noErrorHooks = ['static:app.load', 'static:assets.prepare', 'static:app.preload'];
        for (const hookObj of hookList) {
            if (typeof hookObj.method !== 'function') {
                if (global.env === 'development') {
                    winston_1.default.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
                }
            }
            else {
                let hookFn = hookObj.method;
                if (hookFn.constructor && hookFn.constructor.name !== 'AsyncFunction') {
                    hookFn = util.promisify(hookFn);
                }
                try {
                    // eslint-disable-next-line
                    yield timeout(hookFn(params), 5000, 'timeout');
                }
                catch (err) {
                    if (err && err.message === 'timeout') {
                        winston_1.default.warn(`[plugins] Callback timed out, hook '${hook}' in plugin '${hookObj.id}'`);
                    }
                    else {
                        winston_1.default.error(`[plugins] Error executing '${hook}' in plugin '${hookObj.id}'\n${err.stack}`);
                        if (!noErrorHooks.includes(hook)) {
                            throw err;
                        }
                    }
                }
            }
        }
    });
}
// https://advancedweb.hu/how-to-add-timeout-to-a-promise-in-javascript/
const timeout = (prom, time, error) => {
    let timer;
    return Promise.race([
        prom,
        new Promise((resolve, reject) => {
            timer = setTimeout(reject, time, new Error(error));
        }),
    ]).finally(() => clearTimeout(timer));
};
function fireResponseHook(hook, hookList, params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(hookList) || !hookList.length) {
            return;
        }
        for (const hookObj of hookList) {
            if (typeof hookObj.method !== 'function') {
                if (global.env === 'development') {
                    winston_1.default.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
                }
            }
            else {
                // Skip remaining hooks if headers have been sent
                if (params.res.headersSent) {
                    return;
                }
                // eslint-disable-next-line
                yield hookObj.method(params);
            }
        }
    });
}
exports.default = Hooks;
