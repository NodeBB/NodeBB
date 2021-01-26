'use strict';

define('hooks', [], () => {
	const Hooks = {
		loaded: {},
	};

	Hooks.register = (hookName, listener) => {
		Hooks.loaded[hookName] = Hooks.loaded[hookName] || new Set();
		Hooks.loaded[hookName].add(listener);
	};

	Hooks.hasListeners = hookName => Hooks.loaded[hookName] && Hooks.loaded[hookName].length > 0;

	const _fireFilterHook = (hookName, data) => {
		const listeners = Array.from(Hooks.loaded[hookName]);
		return listeners.reduce((promise, listener) => promise.then(data => listener(data)), Promise.resolve(data));
	};

	const _fireActionHook = (hookName, data) => {
		Hooks.loaded[hookName].forEach(listener => listener(data));
	};

	const _fireStaticHook = (hookName, data) => {
		const listeners = Array.from(Hooks.loaded[hookName]);
		return Promise.allSettled(listeners.map(listener => listener(data))).then(() => Promise.resolve(data));
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
