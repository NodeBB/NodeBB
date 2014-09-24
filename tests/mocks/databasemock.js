/**
 * Database Mock - wrapper for database.js, makes system use separate test db, instead of production
 * ATTENTION: testing db is flushed before every use!
 */

(function(module) {
	'use strict';
	/*global before*/

	var utils = require('./../../public/src/utils.js'),
		path  = require('path'),
		nconf = require('nconf'),
		winston = require('winston'),
		errorText;


	nconf.file({ file: path.join(__dirname, '../../config.json') });
	nconf.defaults({
		base_dir: path.join(__dirname,'../..'),
		themes_path: path.join(__dirname, '../../node_modules'),
		upload_url: path.join(path.sep, '../../uploads', path.sep),
		views_dir: path.join(__dirname, '../../public/templates')
	});

	var dbType = nconf.get('database'),
		testDbConfig = nconf.get('test_database'),
		productionDbConfig = nconf.get(dbType);

	if(!testDbConfig){
		errorText = 'test_database is not defined';
		winston.info(
			"\n===========================================================\n"+
			"Please, add parameters for test database in config.json\n"+
			"For example (redis):\n"+
				'"test_database": {' + '\n' +
				'    "host": "127.0.0.1",' + '\n' +
				'    "port": "6379",' + '\n' +
				'    "password": "",' + '\n' +
				'    "database": "1"' + '\n' +
			'}\n'+
			" or (mongo):\n" +
				'"test_database": {' + '\n' +
				'    "host": "127.0.0.1",' + '\n' +
				'    "port": "27017",' + '\n' +
				'    "password": "",' + '\n' +
				'    "database": "1"' + '\n' +
			'}\n'+
			" or (level):\n" +
				'"test_database": {' + '\n' +
				'    "database": "/path/to/database"' + '\n' +
			'}\n'+
			"==========================================================="
		);
		winston.error(errorText);
		throw new Error(errorText);
	}

	if(	testDbConfig.database === productionDbConfig.database &&
		testDbConfig.host === productionDbConfig.host &&
		testDbConfig.port === productionDbConfig.port
	){
		errorText = 'test_database has the same config as production db';
		winston.error(errorText);
		throw new Error(errorText);
	}

	nconf.set(dbType, testDbConfig);

	var db = require('../../src/database'),
		meta = require('../../src/meta');

	before(function(done) {
		db.init(function(err) {
			//Clean up
			db.flushdb(function(err) {
				if(err) {
					winston.error(err);
					throw new Error(err);
				}

				winston.info('test_database flushed');

				meta.configs.init(function () {
					nconf.set('url', nconf.get('base_url') + (nconf.get('use_port') ? ':' + nconf.get('port') : '') + nconf.get('relative_path'));
					nconf.set('core_templates_path', path.join(__dirname, '../../src/views'));
					nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-vanilla/templates'));
					nconf.set('theme_templates_path', meta.config['theme:templates'] ? path.join(nconf.get('themes_path'), meta.config['theme:id'], meta.config['theme:templates']) : nconf.get('base_templates_path'));

					var	webserver = require('../../src/webserver'),
						sockets = require('../../src/socket.io');
						sockets.init(webserver.server);

					done();
				});
			});
		});
	});

	module.exports = db;

}(module));
