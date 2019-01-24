'use strict';

const validator = require('validator');
var plugins = require('../../plugins');

var hooksController = module.exports;

hooksController.get = function (req, res) {
	var hooks = [];
	Object.keys(plugins.loadedHooks).forEach(function (key, hookIndex) {
		var current = {
			hookName: key,
			methods: [],
			index: 'hook-' + hookIndex,
			count: plugins.loadedHooks[key].length,
		};

		plugins.loadedHooks[key].forEach(function (hookData, methodIndex) {
			current.methods.push({
				id: hookData.id,
				priority: hookData.priority,
				method: hookData.method ? validator.escape(hookData.method.toString()) : 'No plugin function!',
				index: hookIndex + '-code-' + methodIndex,
			});
		});
		hooks.push(current);
	});

	hooks.sort((a, b) => b.count - a.count);

	res.render('admin/advanced/hooks', { hooks: hooks });
};
