/**
 * Database Mock - wrapper for database.js, makes system use separate test db, instead of production
 * ATTENTION: testing db is flushed before every use!
 */

(function (module) {
	'use strict';
	/*global require, before, __dirname*/

	var async = require('async');
	var path  = require('path');
	var nconf = require('nconf');
	var url = require('url');
	var winston = require('winston');
	var errorText;


	nconf.file({ file: path.join(__dirname, '../../config.json') });
	nconf.defaults({
		base_dir: path.join(__dirname,'../..'),
		themes_path: path.join(__dirname, '../../node_modules'),
		upload_url: path.join(path.sep, '../../uploads', path.sep),
		views_dir: path.join(__dirname, '../../public/templates'),
		relative_path: ''
	});

	if (!nconf.get('isCluster')) {
		nconf.set('isPrimary', 'true');
		nconf.set('isCluster', 'false');
	}

	var dbType = nconf.get('database');
	var testDbConfig = nconf.get('test_database');
	var productionDbConfig = nconf.get(dbType);

	if (!testDbConfig){
		errorText = 'test_database is not defined';
		winston.info(
			'\n===========================================================\n' +
			'Please, add parameters for test database in config.json\n' +
			'For example (redis):\n' +
				'"test_database": {' + '\n' +
				'    "host": "127.0.0.1",' + '\n' +
				'    "port": "6379",' + '\n' +
				'    "password": "",' + '\n' +
				'    "database": "1"' + '\n' +
			'}\n' +
			' or (mongo):\n' +
				'"test_database": {' + '\n' +
				'    "host": "127.0.0.1",' + '\n' +
				'    "port": "27017",' + '\n' +
				'    "password": "",' + '\n' +
				'    "database": "1"' + '\n' +
			'}\n' +
			' or (mongo) in a replicaset' + '\n' +
			'"test_database": {' + '\n' +
		    '    "host": "127.0.0.1,127.0.0.1,127.0.0.1",' + '\n' +
		    '    "port": "27017,27018,27019",' + '\n' +
		    '    "username": "",' + '\n' +
		    '    "password": "",' + '\n' +
		    '    "database": "nodebb_test"' + '\n' +
		    '}\n' +
			'==========================================================='
		);
		winston.error(errorText);
		throw new Error(errorText);
	}

	if (testDbConfig.database === productionDbConfig.database &&
		testDbConfig.host === productionDbConfig.host &&
		testDbConfig.port === productionDbConfig.port) {
		errorText = 'test_database has the same config as production db';
		winston.error(errorText);
		throw new Error(errorText);
	}

	nconf.set(dbType, testDbConfig);

	var db = require('../../src/database');
	var meta = require('../../src/meta');

	before(function (done) {
		this.timeout(30000);
		async.waterfall([
			function (next) {
				db.init(next);
			},
			function (next) {
				db.flushdb(next);
			},
			function (next) {
				winston.info('test_database flushed');
				meta.configs.init(next);
			},
			function (next) {
				// nconf defaults, if not set in config
				if (!nconf.get('upload_path')) {
					nconf.set('upload_path', '/public/uploads');
				}
				if (!nconf.get('sessionKey')) {
					nconf.set('sessionKey', 'express.sid');
				}
				// Parse out the relative_url and other goodies from the configured URL
				var urlObject = url.parse(nconf.get('url'));
				var relativePath = urlObject.pathname !== '/' ? urlObject.pathname : '';
				nconf.set('base_url', urlObject.protocol + '//' + urlObject.host);
				nconf.set('secure', urlObject.protocol === 'https:');
				nconf.set('use_port', !!urlObject.port);
				nconf.set('relative_path', relativePath);
				nconf.set('port', urlObject.port || nconf.get('port') || nconf.get('PORT') || (nconf.get('PORT_ENV_VAR') ? nconf.get(nconf.get('PORT_ENV_VAR')) : false) || 4567);
				nconf.set('upload_url', nconf.get('upload_path').replace(/^\/public/, ''));

				nconf.set('core_templates_path', path.join(__dirname, '../../src/views'));
				nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-vanilla/templates'));
				nconf.set('theme_templates_path', meta.config['theme:templates'] ? path.join(nconf.get('themes_path'), meta.config['theme:id'], meta.config['theme:templates']) : nconf.get('base_templates_path'));

				var	webserver = require('../../src/webserver');
				var sockets = require('../../src/socket.io');
				sockets.init(webserver.server);

				require('../../src/notifications').init();
				require('../../src/user').startJobs();

				webserver.listen(next);
			}
		], done);
	});

	module.exports = db;

}(module));
