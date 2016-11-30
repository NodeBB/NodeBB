"use strict";

var fork = require('child_process').fork,
	env = process.env,
	worker, updateWorker,
	incomplete = [],
	running = 0;


module.exports = function (grunt) {
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
			compiling = 'clientCSS';
		} else if (target === 'lessUpdated_Admin') {
			compiling = 'acpCSS';
		} else if (target === 'clientUpdated') {
			compiling = 'js';
		} else if (target === 'templatesUpdated') {
			compiling = 'tpl';
		} else if (target === 'serverUpdated') {
			// Do nothing, just restart
		}

		if (incomplete.indexOf(compiling) === -1) {
			incomplete.push(compiling);
		}

		updateArgs.push('--build');
		updateArgs.push(incomplete.join(','));

		worker.kill();
		if (updateWorker) {
			updateWorker.kill('SIGKILL');
		}
		updateWorker = fork('app.js', updateArgs, { env: env });
		++running;
		updateWorker.on('exit', function () {
			--running;
			if (running === 0) {
				worker = fork('app.js', args, { env: env });
				worker.on('message', function () {
					if (incomplete.length) {
						incomplete = [];

						if (grunt.option('verbose')) {
							grunt.log.writeln('NodeBB restarted in ' + (Date.now() - time) + ' ms');
						}
					}
				});
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