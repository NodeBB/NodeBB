'use strict';

const validator = require('validator');
const plugins = require('../../plugins');

const hooksController = module.exports;

hooksController.get = function (req, res) {
	const hooks = [];
	Object.keys(plugins.loadedHooks).forEach((key, hookIndex) => {
		const current = {
			hookName: key,
			methods: [],
			index: `hook-${hookIndex}`,
			count: plugins.loadedHooks[key].length,
		};

		plugins.loadedHooks[key].forEach((hookData, methodIndex) => {
			current.methods.push({
				id: hookData.id,
				priority: hookData.priority,
				method: hookData.method ? validator.escape(hookData.method.toString()) : 'No plugin function!',
				index: `hook-${hookIndex}-code-${methodIndex}`,
			});
		});
		hooks.push(current);
	});

	hooks.sort((a, b) => b.count - a.count);

	res.render('admin/advanced/hooks', { hooks: hooks });
};
