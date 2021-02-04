'use strict';

define('hooks', [], () => {
	const Hooks = {
		loaded: {},
	};

	Hooks.register = (hookName, method) => {
		Hooks.loaded[hookName] = Hooks.loaded[hookName] || new Set();
		Hooks.loaded[hookName].add(method);
	};
	Hooks.on = Hooks.register;

	Hooks.hasListeners = hookName => Hooks.loaded[hookName] && Hooks.loaded[hookName].size > 0;

	const _onHookError = (e, listener, data) => {
		console.warn(`[hooks] Exception encountered in ${listener.name ? listener.name : 'anonymous function'}, stack trace follows.`);
		console.error(e);
		return Promise.resolve(data);
	};

	const _fireFilterHook = (hookName, data) => {
		if (!Hooks.hasListeners(hookName)) {
			return Promise.resolve(data);
		}

		const listeners = Array.from(Hooks.loaded[hookName]);
		return listeners.reduce((promise, listener) => promise.then((data) => {
			try {
				const result = listener(data);
				return utils.isPromise(result) ?
					result.then(data => Promise.resolve(data)).catch(e => _onHookError(e, listener, data)) :
					result;
			} catch (e) {
				return _onHookError(e, listener, data);
			}
		}), Promise.resolve(data));
	};

	const _fireActionHook = (hookName, data) => {
		if (!Hooks.hasListeners(hookName)) {
			return;
		}

		Hooks.loaded[hookName].forEach(listener => listener(data));

		// Backwards compatibility (remove this when we eventually remove jQuery from NodeBB core)
		$(window).trigger(hookName, data);
	};

	const _fireStaticHook = (hookName, data) => {
		if (!Hooks.hasListeners(hookName)) {
			return Promise.resolve(data);
		}

		const listeners = Array.from(Hooks.loaded[hookName]);
		return Promise.allSettled(listeners.map((listener) => {
			try {
				return listener(data);
			} catch (e) {
				return _onHookError(e, listener);
			}
		})).then(() => Promise.resolve(data));
	};

	Hooks.fire = (hookName, data) => {
		const type = hookName.split(':').shift();

		switch (type) {
			case 'filter':
				return _fireFilterHook(hookName, data);

			case 'action':
				return _fireActionHook(hookName, data);

			case 'static':
				return _fireStaticHook(hookName, data);
		}
	};

	return Hooks;
});
