'use strict';

var fork = require('child_process').fork;
var env = process.env;
var worker;
var updateWorker;
var initWorker;
var incomplete = [];
var running = 0;

env.NODE_ENV = env.NODE_ENV || 'development';

module.exports = function (grunt) {
	var args = [];
	var initArgs = ['--build'];
	if (!grunt.option('verbose')) {
		args.push('--log-level=info');
		initArgs.push('--log-level=info');
	}

	function update(action, filepath, target) {
		var updateArgs = args.slice();
		var compiling;
		var time = Date.now();

		if (target === 'lessUpdated_Client') {
			compiling = 'clientCSS';
		} else if (target === 'lessUpdated_Admin') {
			compiling = 'acpCSS';
		} else if (target === 'clientUpdated') {
			compiling = 'js';
		} else if (target === 'templatesUpdated') {
			compiling = 'tpl';
		} else if (target === 'langUpdated') {
			compiling = 'lang';
		} else if (target === 'serverUpdated') {
			// Do nothing, just restart
		}

		if (compiling && !incomplete.includes(compiling)) {
			incomplete.push(compiling);
		}

		updateArgs.push('--build');
		updateArgs.push(incomplete.join(','));

		worker.kill();
		if (updateWorker) {
			updateWorker.kill('SIGKILL');
		}
		updateWorker = fork('app.js', updateArgs, { env: env });
		running += 1;
		updateWorker.on('exit', function () {
			running -= 1;
			if (running === 0) {
				worker = fork('app.js', args, {
					env: env,
				});
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
					'public/less/*.less',
					'!public/less/admin/**/*.less',
					'node_modules/nodebb-*/**/*.less',
					'!node_modules/nodebb-*/node_modules/**',
					'!node_modules/nodebb-*/.git/**',
				],
				options: {
					interval: 1000,
				},
			},
			lessUpdated_Admin: {
				files: [
					'public/less/admin/**/*.less',
					'node_modules/nodebb-*/**/*.less',
					'!node_modules/nodebb-*/node_modules/**',
					'!node_modules/nodebb-*/.git/**',
				],
				options: {
					interval: 1000,
				},
			},
			clientUpdated: {
				files: [
					'public/src/**/*.js',
					'node_modules/nodebb-*/**/*.js',
					'!node_modules/nodebb-*/node_modules/**',
					'node_modules/benchpressjs/build/benchpress.js',
					'!node_modules/nodebb-*/.git/**',
				],
				options: {
					interval: 1000,
				},
			},
			serverUpdated: {
				files: ['*.js', 'install/*.js', 'src/**/*.js'],
				options: {
					interval: 1000,
				},
			},
			templatesUpdated: {
				files: [
					'src/views/**/*.tpl',
					'node_modules/nodebb-*/**/*.tpl',
					'!node_modules/nodebb-*/node_modules/**',
					'!node_modules/nodebb-*/.git/**',
				],
				options: {
					interval: 1000,
				},
			},
			langUpdated: {
				files: [
					'public/language/en-GB/*.json',
					'public/language/en-GB/**/*.json',
					'node_modules/nodebb-*/**/*.json',
					'!node_modules/nodebb-*/node_modules/**',
					'!node_modules/nodebb-*/.git/**',
					'!node_modules/nodebb-*/plugin.json',
					'!node_modules/nodebb-*/package.json',
					'!node_modules/nodebb-*/theme.json',
				],
				options: {
					interval: 1000,
				},
			},
		},
	});

	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('default', ['watch']);
	env.NODE_ENV = 'development';

	if (grunt.option('skip')) {
		worker = fork('app.js', args, {
			env: env,
		});
	} else {
		initWorker = fork('app.js', initArgs, {
			env: env,
		});

		initWorker.on('exit', function () {
			worker = fork('app.js', args, {
				env: env,
			});
		});
	}

	grunt.event.on('watch', update);
};
