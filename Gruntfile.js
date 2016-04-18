"use strict";

var fork = require('child_process').fork,
	env = process.env,
	worker,
	incomplete = [];


module.exports = function(grunt) {
	var args = [];
	if (!grunt.option('verbose')) {
		args.push('--log-level=info');
	}

	function update(action, filepath, target) {
		var updateArgs = args.slice(),
			fromFile = '',
			compiling = '',
			time = Date.now();
		
		if (target === 'lessUpdated_Client') {
			fromFile = ['js', 'tpl', 'acpLess'];
			compiling = 'clientLess';
		} else if (target === 'lessUpdated_Admin') {
			fromFile = ['js', 'tpl', 'clientLess'];
			compiling = 'acpLess';
		} else if (target === 'clientUpdated') {
			fromFile = ['clientLess', 'acpLess', 'tpl'];
			compiling = 'js';
		} else if (target === 'templatesUpdated') {
			fromFile = ['js', 'clientLess', 'acpLess'];
			compiling = 'tpl';
		} else if (target === 'serverUpdated') {
			fromFile = ['clientLess', 'acpLess', 'js', 'tpl'];
		}

		fromFile = fromFile.filter(function(ext) {
			return incomplete.indexOf(ext) === -1;
		});

		updateArgs.push('--from-file=' + fromFile.join(','));
		incomplete.push(compiling);

		worker.kill();
		worker = fork('app.js', updateArgs, { env: env });

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
			lessUpdated_Client: {
				files: [
					'public/*.less',
					'node_modules/nodebb-*/*.less', 'node_modules/nodebb-*/**/*.less',
					'!node_modules/nodebb-*/node_modules/**',
					'!node_modules/nodebb-*/.git/**'
				]
			},
			lessUpdated_Admin: {
				files: ['public/**/*.less']
			},
			clientUpdated: {
				files: [
					'public/src/**/*.js',
					'node_modules/nodebb-*/*.js', 'node_modules/nodebb-*/**/*.js',
					'!node_modules/nodebb-*/node_modules/**',
					'node_modules/templates.js/lib/templates.js',
					'!node_modules/nodebb-*/.git/**'
				]
			},
			serverUpdated: {
				files: ['*.js', 'install/*.js', 'src/**/*.js']
			},
			templatesUpdated: {
				files: [
					'src/views/**/*.tpl',
					'node_modules/nodebb-*/*.tpl', 'node_modules/nodebb-*/**/*.tpl',
					'!node_modules/nodebb-*/node_modules/**',
					'!node_modules/nodebb-*/.git/**'
				]
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');

	if (grunt.option('skip')) {
		grunt.registerTask('default', ['watch:serverUpdated']);
	} else {
		grunt.registerTask('default', ['watch']);
	}
	

	env.NODE_ENV = 'development';

	worker = fork('app.js', args, { env: env });
	grunt.event.on('watch', update);
};