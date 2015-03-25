"use strict";

var fork = require('child_process').fork,
	env = process.env,
	worker,
	incomplete = [];


module.exports = function(grunt) {
	function update(action, filepath, target) {
		var args = [],
			fromFile = '',
			compiling = '',
			time = Date.now();

		if (!grunt.option('verbose')) {
			args.push('--log-level=info');
		}
		
		if (target === 'lessUpdated') {
			fromFile = ['js','tpl'];
			compiling = 'less';
		} else if (target === 'clientUpdated') {
			fromFile = ['less','tpl'];
			compiling = 'js';
		} else if (target === 'templatesUpdated') {
			fromFile = ['js','less'];
			compiling = 'tpl';
		} else if (target === 'serverUpdated') {
			fromFile = ['less','js','tpl'];
		}

		fromFile = fromFile.filter(function(ext) {
			return incomplete.indexOf(ext) === -1;
		});

		args.push('--from-file=' + fromFile.join(','));
		incomplete.push(compiling);

		worker.kill();
		worker = fork('app.js', args, { env: env });

		worker.on('message', function() {
			if (incomplete.length) {
				incomplete = [];

				if (grunt.option('verbose')) {
					grunt.log.writeln('NodeBB restarted in ' + (Date.now() - time) + ' ms');
				}
			}
		});
	}

	grunt.initConfig({
		watch: {
			lessUpdated: {
				files: ['public/**/*.less', 'node_modules/nodebb-*/*.less', 'node_modules/nodebb-*/*/*.less', 'node_modules/nodebb-*/*/*/*.less', 'node_modules/nodebb-*/*/*/*/*.less']
			},
			clientUpdated: {
				files: ['public/src/**/*.js', 'node_modules/nodebb-*/*.js', 'node_modules/nodebb-*/*/*.js', 'node_modules/nodebb-*/*/*/*.js', 'node_modules/nodebb-*/*/*/*/*.js']
			},
			serverUpdated: {
				files: ['*.js', 'src/**/*.js']
			},
			templatesUpdated: {
				files: ['src/views/**/*.tpl', 'node_modules/nodebb-*/*.tpl', 'node_modules/nodebb-*/*/*.tpl', 'node_modules/nodebb-*/*/*/*.tpl', 'node_modules/nodebb-*/*/*/*/*.tpl', 'node_modules/nodebb-*/*/*/*/*/*.tpl']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.registerTask('default', ['watch']);

	env.NODE_ENV = 'development';

	worker = fork('app.js', [], { env: env });
	grunt.event.on('watch', update);
};