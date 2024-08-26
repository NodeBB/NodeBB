'use strict';

const winston = require('winston');
const plugins = require('.');
const utils = require('../utils');
const als = require('../als');

const Hooks = module.exports;

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
	['filter:flags.getFilters', {
		new: 'filter:flags.init',
		since: 'v2.7.0',
		until: 'v3.0.0',
	}],
	['filter:privileges.global.list', {
		new: 'static:privileges.global.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.global.groups.list', {
		new: 'static:privileges.global.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.global.list_human', {
		new: 'static:privileges.global.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.global.groups.list_human', {
		new: 'static:privileges.global.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.list', {
		new: 'static:privileges.categories.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.groups.list', {
		new: 'static:privileges.categories.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.list_human', {
		new: 'static:privileges.categories.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.groups.list_human', {
		new: 'static:privileges.categories.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],

	['filter:privileges.admin.list', {
		new: 'static:privileges.admin.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.admin.groups.list', {
		new: 'static:privileges.admin.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.admin.list_human', {
		new: 'static:privileges.admin.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
	['filter:privileges.admin.groups.list_human', {
		new: 'static:privileges.admin.init',
		since: 'v3.5.0',
		until: 'v4.0.0',
	}],
]);

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
		winston.debug(`[plugins/fireHook] ${hook}`);
	}

	if (!hookTypeToMethod[hookType]) {
		winston.warn(`[plugins] Unknown hookType: ${hookType}, hook : ${hook}`);
		return;
	}
	let deleteCaller = false;
	if (params && typeof params === 'object' && !Array.isArray(params) && !params.hasOwnProperty('caller')) {
		params.caller = als.getStore();
		deleteCaller = true;
	}
	const result = await hookTypeToMethod[hookType](hook, hookList, params);

	if (hook !== 'action:plugins.firehook' && hook !== 'filter:plugins.firehook') {
		const payload = await Hooks.fire('filter:plugins.firehook', { hook: hook, params: result || params });
		Hooks.fire('action:plugins.firehook', payload);
	}
	if (result !== undefined) {
		if (deleteCaller && result && result.hasOwnProperty('caller')) {
			delete result.caller;
		}
		return result;
	}
};

Hooks.hasListeners = function (hook) {
	return !!(plugins.loadedHooks[hook] && plugins.loadedHooks[hook].length > 0);
};

function hookHandlerPromise(hook, hookObj, params) {
	return new Promise((resolve, reject) => {
		let resolved = false;
		function _resolve(result) {
			if (resolved) {
				winston.warn(`[plugins] ${hook} already resolved in plugin ${hookObj.id}`);
				return;
			}
			resolved = true;
			resolve(result);
		}
		const returned = hookObj.method(params, (err, result) => {
			if (err) reject(err); else _resolve(result);
		});

		if (utils.isPromise(returned)) {
			returned.then(
				payload => _resolve(payload),
				err => reject(err)
			);
			return;
		}

		if (hook.startsWith('filter:') && returned !== undefined) {
			_resolve(returned);
		} else if (hook.startsWith('static:') && hookObj.method.length <= 1) {
			// make sure it is resolved if static hook doesn't use callback
			_resolve();
		}
	});
}

async function fireFilterHook(hook, hookList, params) {
	if (!Array.isArray(hookList) || !hookList.length) {
		return params;
	}

	async function fireMethod(hookObj, params) {
		if (typeof hookObj.method !== 'function') {
			if (global.env === 'development') {
				winston.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
			}
			return params;
		}

		if (hookObj.method.constructor && hookObj.method.constructor.name === 'AsyncFunction') {
			return await hookObj.method(params);
		}
		return hookHandlerPromise(hook, hookObj, params);
	}

	for (const hookObj of hookList) {
		// eslint-disable-next-line
		params = await fireMethod(hookObj, params);
	}
	return params;
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

async function fireStaticHook(hook, hookList, params) {
	if (!Array.isArray(hookList) || !hookList.length) {
		return;
	}
	// don't bubble errors from these hooks, so bad plugins don't stop startup
	const noErrorHooks = ['static:app.load', 'static:assets.prepare', 'static:app.preload'];

	async function fireMethod(hookObj, params) {
		if (typeof hookObj.method !== 'function') {
			if (global.env === 'development') {
				winston.warn(`[plugins] Expected method for hook '${hook}' in plugin '${hookObj.id}' not found, skipping.`);
			}
			return params;
		}

		if (hookObj.method.constructor && hookObj.method.constructor.name === 'AsyncFunction') {
			return timeout(hookObj.method(params), 10000, 'timeout');
		}

		return hookHandlerPromise(hook, hookObj, params);
	}

	for (const hookObj of hookList) {
		try {
			// eslint-disable-next-line
			await fireMethod(hookObj, params);
		} catch (err) {
			if (err && err.message === 'timeout') {
				winston.warn(`[plugins] Callback timed out, hook '${hook}' in plugin '${hookObj.id}'`);
			} else {
				if (!noErrorHooks.includes(hook)) {
					throw err;
				}

				winston.error(`[plugins] Error executing '${hook}' in plugin '${hookObj.id}'\n${err.stack}`);
			}
		}
	}
}

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
