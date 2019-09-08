'use strict';


var async = require('async');
var fork = require('child_process').fork;
var env = process.env;
var worker;
var updateWorker;
var initWorker;
var incomplete = [];
var running = 0;

env.NODE_ENV = env.NODE_ENV || 'development';


var nconf = require('nconf');
nconf.file({
	file: 'config.json',
});

nconf.defaults({
	base_dir: __dirname,
	views_dir: './build/public/templates',
});
var winston = require('winston');
winston.configure({
	transports: [
		new winston.transports.Console({
			handleExceptions: true,
		}),
	],
});
var db = require('./src/database');

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
		watch: {},
	});

	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('default', ['watch']);

	grunt.registerTask('init', function () {
		var done = this.async();
		async.waterfall([
			function (next) {
				db.init(next);
			},
			function (next) {
				db.getSortedSetRange('plugins:active', 0, -1, next);
			},
			function (plugins, next) {
				addBaseThemes(plugins, next);
			},
			function (plugins, next) {
				if (!plugins.includes('nodebb-plugin-composer-default')) {
					plugins.push('nodebb-plugin-composer-default');
				}

				if (process.argv.includes('--core')) {
					plugins = [];
				}

				const lessUpdated_Client = plugins.map(p => 'node_modules/' + p + '/**/*.less');
				const lessUpdated_Admin = plugins.map(p => 'node_modules/' + p + '/**/*.less');
				const clientUpdated = plugins.map(p => 'node_modules/' + p + '/**/*.js');
				const templatesUpdated = plugins.map(p => 'node_modules/' + p + '/**/*.tpl');
				const langUpdated = plugins.map(p => 'node_modules/' + p + '/**/*.json');

				grunt.config(['watch'], {
					lessUpdated_Client: {
						files: [
							'public/less/*.less',
							'!public/less/admin/**/*.less',
							...lessUpdated_Client,
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
							...lessUpdated_Admin,
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
							...clientUpdated,
							'!node_modules/nodebb-*/node_modules/**',
							'node_modules/benchpressjs/build/benchpress.js',
							'!node_modules/nodebb-*/.git/**',
						],
						options: {
							interval: 1000,
						},
					},
					serverUpdated: {
						files: ['*.js', 'install/*.js', 'src/**/*.js', '!src/upgrades/**'],
						options: {
							interval: 1000,
						},
					},
					templatesUpdated: {
						files: [
							'src/views/**/*.tpl',
							...templatesUpdated,
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
							...langUpdated,
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
				});
				next();
			},
		], done);
	});

	grunt.task.run('init');

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

function addBaseThemes(plugins, callback) {
	const themeId = plugins.find(p => p.startsWith('nodebb-theme-'));
	if (!themeId) {
		return setImmediate(callback, null, plugins);
	}
	function getBaseRecursive(themeId) {
		try {
			const baseTheme = require(themeId + '/theme').baseTheme;

			if (baseTheme) {
				plugins.push(baseTheme);
				getBaseRecursive(baseTheme);
			}
		} catch (err) {
			console.log(err);
		}
	}

	getBaseRecursive(themeId);
	callback(null, plugins);
}
