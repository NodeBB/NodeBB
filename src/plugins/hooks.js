'use strict';

var winston = require('winston'),
	async = require('async');

module.exports = function(Plugins) {
	Plugins.deprecatedHooks = {
		'filter:user.delete': 'static:user.delete',
		'filter:user.custom_fields': null,
		'action:user.loggedOut': 'static:user.loggedOut'
	};

	Plugins.deprecatedHooksParams = {
		'action:homepage.get': '{req, res}',
		'filter:register.check': '{req, res}',
		'action:user.loggedOut': '{req, res}',
		'static:user.loggedOut': '{req, res}',
		'filter:categories.build': '{req, res}',
		'filter:category.build': '{req, res}',
		'filter:group.build': '{req, res}',
		'filter:register.build': '{req, res}',
		'filter:composer.build': '{req, res}',
		'filter:popular.build': '{req, res}',
		'filter:recent.build': '{req, res}',
		'filter:topic.build': '{req, res}',
		'filter:users.build': '{req, res}',
		'filter:admin.category.get': '{req, res}',
		'filter:middleware.renderHeader': '{req, res}',
		'filter:widget.render': '{req, res}',
		'filter:middleware.buildHeader': '{req, locals}',
		'action:middleware.pageView': '{req}',
		'action:meta.override404': '{req}'
	};

	/*
		`data` is an object consisting of (* is required):
			`data.hook`*, the name of the NodeBB hook
			`data.method`*, the method called in that plugin
			`data.priority`, the relative priority of the method when it is eventually called (default: 10)
	*/
	Plugins.registerHook = function(id, data, callback) {
		function register() {
			Plugins.loadedHooks[data.hook] = Plugins.loadedHooks[data.hook] || [];
			Plugins.loadedHooks[data.hook].push(data);

			if (typeof callback === 'function') {
				callback();
			}
		}

		var method;

		if (Object.keys(Plugins.deprecatedHooks).indexOf(data.hook) !== -1) {
			winston.warn('[plugins/' + id + '] Hook `' + data.hook + '` is deprecated, ' +
				(Plugins.deprecatedHooks[data.hook] ?
					'please use `' + Plugins.deprecatedHooks[data.hook] + '` instead.' :
					'there is no alternative.'
				)
			);
		} else {
			// handle hook's startsWith, i.e. action:homepage.get
			var _parts = data.hook.split(':');
			_parts.pop();
			var _hook = _parts.join(':');
			if (Plugins.deprecatedHooksParams[_hook]) {
				winston.warn('[plugins/' + id + '] Hook `' + _hook + '` parameters: `' + Plugins.deprecatedHooksParams[_hook] + '`, are being deprecated, '
				+ 'all plugins should now use the `middleware/cls` module instead of hook\'s arguments to get a reference to the `req`, `res` and/or `socket` object(s) (from which you can get the current `uid` if you need to.) '
				+ '- for more info, visit https://docs.nodebb.org/en/latest/plugins/create.html#getting-a-reference-to-each-request-from-within-any-plugin-hook');
				delete Plugins.deprecatedHooksParams[_hook];
			}
		}

		if (data.hook && data.method) {
			data.id = id;
			if (!data.priority) {
				data.priority = 10;
			}

			if (typeof data.method === 'string' && data.method.length > 0) {
				method = data.method.split('.').reduce(function(memo, prop) {
					if (memo && memo[prop]) {
						return memo[prop];
					} else {
						// Couldn't find method by path, aborting
						return null;
					}
				}, Plugins.libraries[data.id]);

				// Write the actual method reference to the hookObj
				data.method = method;

				register();
			} else if (typeof data.method === 'function') {
				register();
			} else {
				winston.warn('[plugins/' + id + '] Hook method mismatch: ' + data.hook + ' => ' + data.method);
			}
		}
	};

	Plugins.fireHook = function(hook, params, callback) {
		callback = typeof callback === 'function' ? callback : function() {};

		var hookList = Plugins.loadedHooks[hook];
		var hookType = hook.split(':')[0];

		switch (hookType) {
			case 'filter':
				fireFilterHook(hook, hookList, params, callback);
				break;
			case 'action':
				fireActionHook(hook, hookList, params, callback);
				break;
			case 'static':
				fireStaticHook(hook, hookList, params, callback);
				break;
			default:
				winston.warn('[plugins] Unknown hookType: ' + hookType + ', hook : ' + hook);
				break;
		}
	};

	function fireFilterHook(hook, hookList, params, callback) {
		if (!Array.isArray(hookList) || !hookList.length) {
			return callback(null, params);
		}

		async.reduce(hookList, params, function(params, hookObj, next) {
			if (typeof hookObj.method !== 'function') {
				if (global.env === 'development') {
					winston.warn('[plugins] Expected method for hook \'' + hook + '\' in plugin \'' + hookObj.id + '\' not found, skipping.');
				}
				return next(null, params);
			}

			hookObj.method(params, next);

		}, function(err, values) {
			if (err) {
				winston.error('[plugins] ' + hook + ',  ' + err.message);
			}

			callback(err, values);
		});
	}

	function fireActionHook(hook, hookList, params, callback) {
		if (!Array.isArray(hookList) || !hookList.length) {
			return callback();
		}
		async.each(hookList, function(hookObj, next) {

			if (typeof hookObj.method !== 'function') {
				if (global.env === 'development') {
					winston.warn('[plugins] Expected method for hook \'' + hook + '\' in plugin \'' + hookObj.id + '\' not found, skipping.');
				}
				return next();
			}

			hookObj.method(params);
			next();
		}, callback);
	}

	function fireStaticHook(hook, hookList, params, callback) {
		if (!Array.isArray(hookList) || !hookList.length) {
			return callback();
		}
		async.each(hookList, function(hookObj, next) {
			if (typeof hookObj.method === 'function') {
				var timedOut = false;

				var timeoutId = setTimeout(function() {
					winston.warn('[plugins] Callback timed out, hook \'' + hook + '\' in plugin \'' + hookObj.id + '\'');
					timedOut = true;
					next();
				}, 5000);

				try {
					hookObj.method(params, function() {
						clearTimeout(timeoutId);
						if (!timedOut) {
							next.apply(null, arguments);
						}
					});
				} catch(err) {
					winston.error('[plugins] Error executing \'' + hook + '\' in plugin \'' + hookObj.id + '\'');
					winston.error(err);
					clearTimeout(timeoutId);
					next();
				}
			} else {
				next();
			}
		}, callback);
	}

	Plugins.hasListeners = function(hook) {
		return !!(Plugins.loadedHooks[hook] && Plugins.loadedHooks[hook].length > 0);
	};
};