var TemplatesRenderer = require('../../public/src/templatesRenderer'),
	nconf = require('nconf'),
	path = require('path');
	merge = require('merge-util');

TemplatesRenderer.registerLoader('.tpl', require('./tpl'));

module.exports = function(app) {
	app.set('json spaces', process.env.NODE_ENV === 'development' ? 4 : 0);
	app.render = function(name, options, fn) {
		var opts = {};
		if ('function' == typeof options) {
			fn = options, options = {};
		}
		merge(opts, this.locals);
		if (options._locals) {
			merge(opts, options._locals);
		}
		merge(opts, options);
		try {
			TemplatesRenderer.render(name, '', opts, fn);
		} catch (err) {
			fn(err);
		}
	};
};

