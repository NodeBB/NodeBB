'use strict';

const path = require('path');
const nconf = require('nconf');

nconf.argv().env({
	separator: '__',
});
const winston = require('winston');
const { fork } = require('child_process');

const { env } = process;
let worker;

env.NODE_ENV = env.NODE_ENV || 'development';

const configFile = path.resolve(__dirname, nconf.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('./src/prestart');

prestart.loadConfig(configFile);

const db = require('./src/database');
const plugins = require('./src/plugins');

module.exports = function (grunt) {
	const args = [];

	if (!grunt.option('verbose')) {
		args.push('--log-level=info');
		nconf.set('log-level', 'info');
	}
	prestart.setupWinston();

	grunt.initConfig({
		watch: {},
	});

	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('default', ['watch']);

	grunt.registerTask('init', async function () {
		const done = this.async();
		let pluginList = [];
		if (!process.argv.includes('--core')) {
			await db.init();
			pluginList = await plugins.getActive();
			addBaseThemes(pluginList);
			if (!pluginList.includes('nodebb-plugin-composer-default')) {
				pluginList.push('nodebb-plugin-composer-default');
			}
			if (!pluginList.includes('nodebb-theme-harmony')) {
				pluginList.push('nodebb-theme-harmony');
			}
		}

		const styleUpdated_Client = pluginList.map(p => `node_modules/${p}/*.scss`)
			.concat(pluginList.map(p => `node_modules/${p}/*.css`))
			.concat(pluginList.map(p => `node_modules/${p}/+(public|static|scss)/**/*.scss`))
			.concat(pluginList.map(p => `node_modules/${p}/+(public|static)/**/*.css`));

		const clientUpdated = pluginList.map(p => `node_modules/${p}/+(public|static)/**/*.js`);
		const serverUpdated = pluginList.map(p => `node_modules/${p}/*.js`)
			.concat(pluginList.map(p => `node_modules/${p}/+(lib|src)/**/*.js`));

		const templatesUpdated = pluginList.map(p => `node_modules/${p}/+(public|static|templates)/**/*.tpl`);
		const langUpdated = pluginList.map(p => `node_modules/${p}/+(public|static|languages)/**/*.json`);
		const interval = 100;
		grunt.config(['watch'], {
			styleUpdated: {
				files: [
					'public/scss/**/*.scss',
					...styleUpdated_Client,
				],
				options: {
					interval: interval,
				},
			},
			clientUpdated: {
				files: [
					'public/src/**/*.js',
					'public/vendor/**/*.js',
					...clientUpdated,
					'node_modules/benchpressjs/build/benchpress.js',
				],
				options: {
					interval: interval,
				},
			},
			serverUpdated: {
				files: [
					'app.js',
					'install/*.js',
					'src/**/*.js',
					'public/src/modules/translator.common.js',
					'public/src/modules/helpers.common.js',
					'public/src/utils.common.js',
					serverUpdated,
					'!src/upgrades/**',
				],
				options: {
					interval: interval,
				},
			},
			templatesUpdated: {
				files: [
					'src/views/**/*.tpl',
					...templatesUpdated,
				],
				options: {
					interval: interval,
				},
			},
			langUpdated: {
				files: [
					'public/language/en-GB/*.json',
					'public/language/en-GB/**/*.json',
					...langUpdated,
				],
				options: {
					interval: interval,
				},
			},
		});
		const build = require('./src/meta/build');
		if (!grunt.option('skip')) {
			await build.build(true, { watch: true });
		}
		run();
		done();
	});

	function run() {
		if (worker) {
			worker.kill();
		}

		const execArgv = [];
		const inspect = process.argv.find(a => a.startsWith('--inspect'));

		if (inspect) {
			execArgv.push(inspect);
		}

		worker = fork('app.js', args, {
			env,
			execArgv,
		});
	}

	grunt.task.run('init');

	grunt.event.removeAllListeners('watch');
	grunt.event.on('watch', (action, filepath, target) => {
		let compiling;
		if (target === 'styleUpdated') {
			compiling = ['clientCSS', 'acpCSS'];
		} else if (target === 'clientUpdated') {
			compiling = ['js'];
		} else if (target === 'templatesUpdated') {
			compiling = ['tpl'];
		} else if (target === 'langUpdated') {
			compiling = ['lang'];
		} else if (target === 'serverUpdated') {
			// empty require cache
			const paths = ['./src/meta/build.js', './src/meta/index.js'];
			paths.forEach(p => delete require.cache[require.resolve(p)]);
			return run();
		}

		require('./src/meta/build').build(compiling, { webpack: false }, (err) => {
			if (err) {
				winston.error(err.stack);
			}
			if (worker) {
				worker.send({
					compiling: compiling,
					livereload: true, // Send livereload event via Socket.IO for instant browser refresh
				});
			}
		});
	});
};

function addBaseThemes(pluginList) {
	let themeId = pluginList.find(p => p.includes('nodebb-theme-'));
	if (!themeId) {
		return pluginList;
	}
	let baseTheme;
	do {
		try {
			baseTheme = require(`${themeId}/theme`).baseTheme;
		} catch (err) {
			console.log(err);
		}

		if (baseTheme) {
			pluginList.push(baseTheme);
			themeId = baseTheme;
		}
	} while (baseTheme);
	return pluginList;
}
