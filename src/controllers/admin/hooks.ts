'use strict';

import validator from 'validator';
const plugins = require('../../plugins');

const hooksController  = {} as any;

hooksController.get = function (req, res) {
	const hooks: any[] = [];
	Object.keys(plugins.loadedHooks).forEach((key, hookIndex) => {
		const current = {
			hookName: key,
			methods: [] as any,
			index: `hook-${hookIndex}`,
			count: plugins.loadedHooks[key].length,
		} as any;

		plugins.loadedHooks[key].forEach((hookData, methodIndex: number) => {
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
