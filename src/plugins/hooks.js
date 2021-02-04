'use strict';

const winston = require('winston');
const async = require('async');
const utils = require('../utils');
const plugins = require('.');

const Hooks = module.exports;

Hooks.deprecatedHooks = {
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
	if (global.env === 'development' && hook !== 'action:plugins.firehook') {
		winston.verbose(`[plugins/fireHook] ${hook}`);
	}

	if (!hookTypeToMethod[hookType]) {
		winston.warn(`[plugins] Unknown hookType: ${hookType}, hook : ${hook}`);
		return;
	}
	const result = await hookTypeToMethod[hookType](hook, hookList, params);

	if (hook !== 'action:plugins.firehook') {
		Hooks.fire('action:plugins.firehook', { hook: hook, params: params });
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
			/* eslint-disable no-await-in-loop */
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
	await async.each(hookList, (hookObj, next) => {
		if (typeof hookObj.method !== 'function') {
			return next();
		}

		let timedOut = false;
		const timeoutId = setTimeout(() => {
			winston.warn(`[plugins] Callback timed out, hook '${hook}' in plugin '${hookObj.id}'`);
			timedOut = true;
			next();
		}, 5000);

		const callback = (err) => {
			clearTimeout(timeoutId);
			if (err) {
				winston.error(`[plugins] Error executing '${hook}' in plugin '${hookObj.id}'`);
				winston.error(err.stack);
			}
			if (!timedOut) {
				next(noErrorHooks.includes(hook) ? null : err);
			}
		};
		try {
			const returned = hookObj.method(params, callback);
			if (utils.isPromise(returned)) {
				returned.then(
					payload => setImmediate(callback, null, payload),
					err => setImmediate(callback, err)
				);
			}
		} catch (err) {
			callback(err);
		}
	});
}

async function fireResponseHook(hook, hookList, params) {
	if (!Array.isArray(hookList) || !hookList.length) {
		return;
	}
	await async.eachSeries(hookList, async (hookObj) => {
		if (typeof hookObj.method !== 'function') {
			if (global.env === 'development') {
				winston.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
			}
			return;
		}

		// Skip remaining hooks if headers have been sent
		if (params.res.headersSent) {
			return;
		}

		await hookObj.method(params);
	});
}
