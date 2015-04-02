(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as a module.
		define('templatesRenderer', factory);
	} else if (typeof exports === 'object') {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like environments that support module.exports,
		// like Node.
		module.exports = factory();
	} else {
		// Browser globals (root is window)
		root.TemplatesRenderer = factory();
	}
}(this, function () {
	var TemplatesRenderer = {},
		templatesCache = {},
		typesCache = {},
		loaders = {};

	TemplatesRenderer.updateTypesCache = function(obj) {
		for (name in obj) {
			if (obj.hasOwnProperty(name)) {
				typesCache[name] = obj[name];
			}
		}
	};

	TemplatesRenderer.lookupType = function(name) {
		return typesCache[name];
	};

	TemplatesRenderer.registerLoader = function(ext, loader) {
		loaders[ext] = loader;
	};

	TemplatesRenderer.load = function(name, callback) {
		if (templatesCache[name]) {
			callback(null, templatesCache[name]);
			return;
		}

		var ext = TemplatesRenderer.lookupType(name);
		if (!ext) {
			callback(new Error('Can\'t determine template type: ' + name));
			return;
		}

		if (!loaders[ext]) {
			callback(new Error('Loader not found for extension ' + ext));
			return;
		}

		try {
			loaders[ext](name, callback);
		} catch (err) {
			callback(err);
		};
	};

	TemplatesRenderer.render = function(name, block, data, callback) {
		TemplatesRenderer.load(name, function(err, render) {
			if (err) {
				callback(err);
				return;
			}

			try {
				render(name, block, data, callback);
			} catch (err) {
				callback(err);
			}
		});
	};

	return TemplatesRenderer;
}));
