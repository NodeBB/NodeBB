'use strict';

const async = require('async');
const util = require('util');
const winston = require('winston');
const plugins = require('.');
const utils = require('../utils');

const Hooks = module.exports;

Hooks.deprecatedHooks = {
	'filter:email.send': 'static:email.send',	// 👋 @ 1.18.0
	'filter:router.page': 'response:router.page',	// 👋 @ 2.0.0
};

Hooks.internals = {
	_register: function (data) {
		plugins.loadedHooks[data.hook] = plugins.loadedHooks[data.hook] || [];
		plugins.loadedHooks[data.hook].push(data);
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
		winston.warn(`[plugins/${id}] registerHook called with invalid data.hook/method`, data);
		return;
	}

	// `hasOwnProperty` needed for hooks with no alternative (set to null)
	if (Hooks.deprecatedHooks.hasOwnProperty(data.hook)) {
		const deprecated = Hooks.deprecatedHooks[data.hook];

		if (deprecated) {
			winston.warn(`[plugins/${id}] Hook "${data.hook}" is deprecated, please use "${deprecated}" instead.`);
		} else {
			winston.warn(`[plugins/${id}] Hook "${data.hook}" is deprecated, there is no alternative.`);
		}
	}

	data.id = id;
	if (!data.priority) {
		data.priority = 10;
	}

	if (Array.isArray(data.method) && data.method.every(method => typeof method === 'function' || typeof method === 'string')) {
		// Go go gadget recursion!
		data.method.forEach((method) => {
			const singularData = { ...data, method: method };
			Hooks.register(id, singularData);
		});
	} else if (typeof data.method === 'string' && data.method.length > 0) {
		const method = data.method.split('.').reduce((memo, prop) => {
			if (memo && memo[prop]) {
				return memo[prop];
			}
			// Couldn't find method by path, aborting
			return null;
		}, plugins.libraries[data.id]);

		// Write the actual method reference to the hookObj
		data.method = method;

		Hooks.internals._register(data);
	} else if (typeof data.method === 'function') {
		Hooks.internals._register(data);
	} else {
		winston.warn(`[plugins/${id}] Hook method mismatch: ${data.hook} => ${data.method}`);
	}
};

Hooks.unregister = function (id, hook, method) {
	const hooks = plugins.loadedHooks[hook] || [];
	plugins.loadedHooks[hook] = hooks.filter(hookData => hookData && hookData.id !== id && hookData.method !== method);
};

Hooks.fire = async function (hook, params) {
	const hookList = plugins.loadedHooks[hook];
	const hookType = hook.split(':')[0];
	if (global.env === 'development' && hook !== 'action:plugins.firehook' && hook !== 'filter:plugins.firehook') {
		winston.verbose(`[plugins/fireHook] ${hook}`);
	}

	if (!hookTypeToMethod[hookType]) {
		winston.warn(`[plugins] Unknown hookType: ${hookType}, hook : ${hook}`);
		return;
	}
	const result = await hookTypeToMethod[hookType](hook, hookList, params);

	if (hook !== 'action:plugins.firehook' && hook !== 'filter:plugins.firehook') {
		const payload = await Hooks.fire('filter:plugins.firehook', { hook: hook, params: result || params });
		Hooks.fire('action:plugins.firehook', payload);
	}
	if (result !== undefined) {
		return result;
	}
};

Hooks.hasListeners = function (hook) {
	return !!(plugins.loadedHooks[hook] && plugins.loadedHooks[hook].length > 0);
};

async function fireFilterHook(hook, hookList, params) {
	if (!Array.isArray(hookList) || !hookList.length) {
		return params;
	}
	return await async.reduce(hookList, params, (params, hookObj, next) => {
		if (typeof hookObj.method !== 'function') {
			if (global.env === 'development') {
				winston.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
			}
			return next(null, params);
		}
		const returned = hookObj.method(params, next);
		if (utils.isPromise(returned)) {
			returned.then(
				payload => setImmediate(next, null, payload),
				err => setImmediate(next, err)
			);
		}
	});
	// breaks plugins that use a non-async function ie emoji-one parse.raw
	// for (const hookObj of hookList) {
	// 	if (typeof hookObj.method !== 'function') {
	// 		if (global.env === 'development') {
	// 			winston.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
	// 		}
	// 	} else {
	// 		let hookFn = hookObj.method;
	// 		if (hookFn.constructor && hookFn.constructor.name !== 'AsyncFunction') {
	// 			hookFn = util.promisify(hookFn);
	// 		}
	// 		// eslint-disable-next-line
	// 		params = await hookFn(params);
	// 	}
	// }
	// return params;
}

async function fireActionHook(hook, hookList, params) {
	if (!Array.isArray(hookList) || !hookList.length) {
		return;
	}
	for (const hookObj of hookList) {
		if (typeof hookObj.method !== 'function') {
			if (global.env === 'development') {
				winston.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
			}
		} else {
			// eslint-disable-next-line
			await hookObj.method(params);
		}
	}
}

async function fireStaticHook(hook, hookList, params) {
	if (!Array.isArray(hookList) || !hookList.length) {
		return;
	}
	// don't bubble errors from these hooks, so bad plugins don't stop startup
	const noErrorHooks = ['static:app.load', 'static:assets.prepare', 'static:app.preload'];

	for (const hookObj of hookList) {
		if (typeof hookObj.method !== 'function') {
			if (global.env === 'development') {
				winston.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
			}
		} else {
			let hookFn = hookObj.method;
			if (hookFn.constructor && hookFn.constructor.name !== 'AsyncFunction') {
				hookFn = util.promisify(hookFn);
			}

			try {
				// eslint-disable-next-line
				await timeout(hookFn(params), 5000, 'timeout');
			} catch (err) {
				if (err && err.message === 'timeout') {
					winston.warn(`[plugins] Callback timed out, hook '${hook}' in plugin '${hookObj.id}'`);
				} else {
					winston.error(`[plugins] Error executing '${hook}' in plugin '${hookObj.id}'\n${err.stack}`);
					if (!noErrorHooks.includes(hook)) {
						throw err;
					}
				}
			}
		}
	}
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

async function fireResponseHook(hook, hookList, params) {
	if (!Array.isArray(hookList) || !hookList.length) {
		return;
	}
	for (const hookObj of hookList) {
		if (typeof hookObj.method !== 'function') {
			if (global.env === 'development') {
				winston.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
			}
		} else {
			// Skip remaining hooks if headers have been sent
			if (params.res.headersSent) {
				return;
			}
			// eslint-disable-next-line
			await hookObj.method(params);
		}
	}
}
