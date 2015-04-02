var TemplatesRenderer = require('../../public/src/templatesRenderer'),
	templates = require('templates.js'),
	fs = require('fs'),
	nconf = require('nconf'),
	async = require('async'),
	path = require('path');

module.exports = function(name, callback) {
	var base = nconf.get('views_dir'),
		filename = path.join(base, name) + '.tpl';

	fs.exists(filename, function(exists) {
		if (!exists) {
			callback(new Error('Template not found: ' + name + '.tpl'));
			return;
		}

		fs.readFile(filename, {encoding: 'utf8'}, function(err, template) {
			if (err) {
				callback(err);
				return;
			}

			var render = function(name, block, data, fn) {
				var result = templates.parse(template.toString(), data);
				fn(null, result);
			};

			callback(null, render);
		});
	});
};
