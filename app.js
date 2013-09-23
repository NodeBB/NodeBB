/*
	NodeBB - A forum powered by node in development by designcreateplay
	Copyright (C) 2013  DesignCreatePlay Inc.

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

(function () {
	"use strict";

	// Configuration setup
	var nconf = require('nconf');
	nconf.argv().env();

	var fs = require('fs'),
		async = require('async'),
		winston = require('winston'),
		pkg = require('./package.json'),
		path = require('path'),
		uglifyjs = require('uglify-js'),
		meta;

	// Runtime environment
	global.env = process.env.NODE_ENV || 'production';

	winston.remove(winston.transports.Console);
	winston.add(winston.transports.Console, {
		colorize: true
	});

	winston.add(winston.transports.File, {
		filename: 'error.log',
		level: 'error'
	});

	// TODO: remove once https://github.com/flatiron/winston/issues/280 is fixed
	winston.err = function (err) {
		winston.error(err.stack);
	};

	// Log GNU copyright info along with server info
	winston.info('NodeBB v' + pkg.version + ' Copyright (C) 2013 DesignCreatePlay Inc.');
	winston.info('This program comes with ABSOLUTELY NO WARRANTY.');
	winston.info('This is free software, and you are welcome to redistribute it under certain conditions.');
	winston.info('');


	if (fs.existsSync(__dirname + '/config.json') && (!nconf.get('setup') && !nconf.get('upgrade'))) {
		// Load server-side configs
		nconf.file({
			file: __dirname + '/config.json'
		});
		meta = require('./src/meta.js');

		nconf.set('url', nconf.get('base_url') + (nconf.get('use_port') ? ':' + nconf.get('port') : '') + nconf.get('relative_path') + '/');
		nconf.set('upload_url', nconf.get('url') + 'uploads/');

		winston.info('Initializing NodeBB v' + pkg.version + ', on port ' + nconf.get('port') + ', using Redis store at ' + nconf.get('redis:host') + ':' + nconf.get('redis:port') + '.');

		if (process.env.NODE_ENV === 'development') {
			winston.info('Base Configuration OK.');
		}

		// Minify JS
		var toMinify = [
			'/vendor/jquery/js/jquery.js',
			'/vendor/jquery/js/jquery-ui-1.10.3.custom.min.js',
			'/vendor/jquery/js/jquery.timeago.js',
			'/vendor/bootstrap/js/bootstrap.min.js',
			'/src/app.js',
			'/vendor/requirejs/require.js',
			'/vendor/bootbox/bootbox.min.js',
			'/src/templates.js',
			'/src/ajaxify.js',
			'/src/jquery.form.js',
			'/src/utils.js'
		],
			minified, mtime;
		toMinify = toMinify.map(function (jsPath) {
			return path.join(__dirname + '/public', jsPath);
		});
		async.parallel({
			mtime: function (next) {
				async.map(toMinify, fs.stat, function (err, stats) {
					async.reduce(stats, 0, function (memo, item, callback) {
						mtime = +new Date(item.mtime);
						callback(null, mtime > memo ? mtime : memo);
					}, next);
				});
			},
			minFile: function (next) {
				var minFile = path.join(__dirname, 'public/src/nodebb.min.js');
				if (!fs.existsSync(minFile)) {
					winston.warn('No minified client-side library found');
					return next(null, 0);
				}

				fs.stat(minFile, function (err, stat) {
					next(err, +new Date(stat.mtime));
				});
			}
		}, function (err, results) {
			if (results.minFile > results.mtime) {
				winston.info('No changes to client-side libraries -- skipping minification');
			} else {
				winston.info('Minifying client-side libraries');
				minified = uglifyjs.minify(toMinify);
				fs.writeFile(path.join(__dirname, '/public/src', 'nodebb.min.js'), minified.code, function (err) {
					if (!err) {
						winston.info('Minified client-side libraries');
					} else {
						winston.error('Problem minifying client-side libraries, exiting.');
						process.exit();
					}
				});
			}
		});

		meta.configs.init(function () {
			// Initial setup for Redis & Reds
			var reds = require('reds'),
				RDB = require('./src/redis.js');

			reds.createClient = function () {
				return reds.client || (reds.client = RDB);
			};

			var templates = require('./public/src/templates.js'),
				webserver = require('./src/webserver.js'),
				websockets = require('./src/websockets.js'),
				plugins = require('./src/plugins'); // Don't remove this - plugins initializes itself

			global.templates = {};
			templates.init([
				'header', 'footer', 'logout', 'outgoing', 'admin/header', 'admin/footer', 'admin/index',
				'emails/reset', 'emails/reset_plaintext', 'emails/email_confirm', 'emails/email_confirm_plaintext',
				'emails/header', 'emails/footer',

				'noscript/header', 'noscript/home', 'noscript/category', 'noscript/topic'
			]);

			templates.ready(webserver.init);
		});

	} else if (nconf.get('upgrade')) {
		meta = require('./src/meta.js');

		meta.configs.init(function () {
			require('./src/upgrade').upgrade();
		});
	} else {
		// New install, ask setup questions
		if (nconf.get('setup')) {
			winston.info('NodeBB Setup Triggered via Command Line');
		} else {
			winston.warn('Configuration not found, starting NodeBB setup');
		}

		var install = require('./src/install');

		winston.info('Welcome to NodeBB!');
		winston.info('This looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.');
		winston.info('Press enter to accept the default setting (shown in brackets).');

		install.setup(function (err) {
			if (err) {
				winston.error('There was a problem completing NodeBB setup: ', err.message);
			} else {
				winston.info('NodeBB Setup Completed.');
			}

			process.exit();
		});
	}
}());