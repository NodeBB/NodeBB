'use strict';

var nconf = require('nconf');
var url = require('url');
var winston = require('winston');
var path = require('path');

var pkg = require('../package.json');
var dirname = require('./cli/paths').baseDir;

function setupWinston() {
	winston.remove(winston.transports.Console);
	winston.add(winston.transports.Console, {
		colorize: nconf.get('log-colorize') !== 'false',
		timestamp: function () {
			var date = new Date();
			return nconf.get('json-logging') ? date.toJSON() :
				date.toISOString() + ' [' + global.process.pid + ']';
		},
		level: nconf.get('log-level') || (global.env === 'production' ? 'info' : 'verbose'),
		json: !!nconf.get('json-logging'),
		stringify: !!nconf.get('json-logging'),
	});
}

function loadConfig(configFile) {
	winston.verbose('* using configuration stored in: %s', configFile);

	nconf.file({
		file: configFile,
	});

	nconf.defaults({
		base_dir: dirname,
		themes_path: path.join(dirname, 'node_modules'),
		upload_path: 'public/uploads',
		views_dir: path.join(dirname, 'build/public/templates'),
		version: pkg.version,
	});

	if (!nconf.get('isCluster')) {
		nconf.set('isPrimary', 'true');
		nconf.set('isCluster', 'false');
	}
	var isPrimary = nconf.get('isPrimary');
	nconf.set('isPrimary', isPrimary === undefined ? 'true' : isPrimary);

	// Ensure themes_path is a full filepath
	nconf.set('themes_path', path.resolve(dirname, nconf.get('themes_path')));
	nconf.set('core_templates_path', path.join(dirname, 'src/views'));
	nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-persona/templates'));

	nconf.set('upload_path', path.resolve(nconf.get('base_dir'), nconf.get('upload_path')));

	if (nconf.get('url')) {
		nconf.set('url_parsed', url.parse(nconf.get('url')));
	}

	// Explicitly cast 'jobsDisabled' as Bool
	var castAsBool = ['jobsDisabled'];
	nconf.stores.env.readOnly = false;
	castAsBool.forEach(function (prop) {
		var value = nconf.get(prop);
		if (value) {
			nconf.set(prop, typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
		}
	});
	nconf.stores.env.readOnly = true;

	nconf.set('runJobs', nconf.get('isPrimary') === 'true' && !nconf.get('jobsDisabled'));
}

function versionCheck() {
	var version = process.version.slice(1);
	var range = pkg.engines.node;
	var semver = require('semver');
	var compatible = semver.satisfies(version, range);

	if (!compatible) {
		winston.warn('Your version of Node.js is too outdated for NodeBB. Please update your version of Node.js.');
		winston.warn('Recommended ' + range.green + ', '.reset + version.yellow + ' provided\n'.reset);
	}
}

exports.setupWinston = setupWinston;
exports.loadConfig = loadConfig;
exports.versionCheck = versionCheck;
