var	async = require('async'),
	utils = require('../public/src/utils.js'),
	fs = require('fs'),
	url = require('url'),
	path = require('path'),
	install = {
		questions: [
			'base_url|Publically accessible URL of this installation? (http://localhost)',
			'port|Port number of your install? (4567)',
			'use_port|Will you be using a port number to access NodeBB? (y)',
			'redis:host|Host IP or address of your Redis instance? (127.0.0.1)',
			'redis:port|Host port of your Redis instance? (6379)',
			'redis:password|Password of your Redis database? (no password)',
			'secret|Your NodeBB secret? (keyboard mash for a bit here)',
			'bcrypt_rounds|The number of rounds to use for bcrypt.genSalt? (10)'
		],
		defaults: {
			"base_url": 'http://localhost',
			"port": 4567,
			"use_port": true,
			"redis:host": '127.0.0.1',
			"redis:port": 6379,
			"redis:password": '',
			"secret": utils.generateUUID(),
			"bcrypt_rounds": 10,
			"upload_path": '/public/uploads'
		},
		ask: function(question, callback) {
			process.stdin.resume();
			process.stdout.write(question + ': ');

			process.stdin.once('data', function(data) {
				callback(data.toString().trim());
			});
		},
		setup: function(callback) {
			var	config = {};
			for(d in install.defaults) config[d] = install.defaults[d];

			async.eachSeries(install.questions, function(question, next) {
				var question = question.split('|');
				install.ask(question[1], function(value) {
					if (value !== '') config[question[0]] = value;
					next();
				});
			}, function() {
				var urlObject = url.parse(config.base_url),
					relative_path = (urlObject.pathname && urlObject.pathname.length > 1) ? urlObject.pathname : '',
					host = urlObject.host,
					protocol = urlObject.protocol,
					server_conf = config,
					client_conf = {
						socket: {
							address: protocol + '//' + host,
							port: config.port
						},
						api_url: protocol + '//' + host + (config.use_port ? ':' + config.port : '') + relative_path + '/api/',
						relative_path: relative_path
					};

				server_conf.relative_path = relative_path;

				install.save(server_conf, client_conf, callback);
			});
		},
		save: function(server_conf, client_conf, callback) {
			// Server Config
			async.parallel([
				function(next) {
					fs.writeFile(path.join(__dirname, '../', 'config.json'), JSON.stringify(server_conf, null, 4), function(err) {
						next(err);
					});
				},
				function(next) {
					fs.writeFile(path.join(__dirname, '../', 'public', 'config.json'), JSON.stringify(client_conf, null, 4), function(err) {
						next(err);
					});
				}
			], function(err) {
				process.stdout.write(
					"\n\nConfiguration Saved OK\n\n"
				);

				callback(err);
			});
		}
	};

module.exports = install;