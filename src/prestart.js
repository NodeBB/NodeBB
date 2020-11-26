'use strict';

const nconf = require('nconf');
const url = require('url');
const winston = require('winston');
const path = require('path');

const pkg = require('../package.json');
const { paths } = require('./constants');

function setupWinston() {
	if (!winston.format) {
		return;
	}

	var formats = [];
	if (nconf.get('log-colorize') !== 'false') {
		formats.push(winston.format.colorize());
	}

	if (nconf.get('json-logging')) {
		formats.push(winston.format.timestamp());
		formats.push(winston.format.json());
	} else {
		const timestampFormat = winston.format((info) => {
			var dateString = new Date().toISOString() + ' [' + nconf.get('port') + '/' + global.process.pid + ']';
			info.level = dateString + ' - ' + info.level;
			return info;
		});
		formats.push(timestampFormat());
		formats.push(winston.format.splat());
		formats.push(winston.format.simple());
	}

	winston.configure({
		level: nconf.get('log-level') || (process.env.NODE_ENV === 'production' ? 'info' : 'verbose'),
		format: winston.format.combine.apply(null, formats),
		transports: [
			new winston.transports.Console({
				handleExceptions: true,
			}),
		],
	});
}

function loadConfig(configFile) {
	nconf.file({
		file: configFile,
	});

	nconf.defaults({
		base_dir: paths.baseDir,
		themes_path: paths.nodeModules,
		upload_path: 'public/uploads',
		views_dir: path.join(paths.baseDir, 'build/public/templates'),
		version: pkg.version,
		isCluster: false,
		isPrimary: true,
		jobsDisabled: false,
	});

	// Explicitly cast as Bool, loader.js passes in isCluster as string 'true'/'false'
	var castAsBool = ['isCluster', 'isPrimary', 'jobsDisabled'];
	nconf.stores.env.readOnly = false;
	castAsBool.forEach(function (prop) {
		var value = nconf.get(prop);
		if (value !== undefined) {
			nconf.set(prop, typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
		}
	});
	nconf.stores.env.readOnly = true;
	nconf.set('runJobs', nconf.get('isPrimary') && !nconf.get('jobsDisabled'));

	// Ensure themes_path is a full filepath
	nconf.set('themes_path', path.resolve(paths.baseDir, nconf.get('themes_path')));
	nconf.set('core_templates_path', path.join(paths.baseDir, 'src/views'));
	nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-persona/templates'));

	nconf.set('upload_path', path.resolve(nconf.get('base_dir'), nconf.get('upload_path')));
	nconf.set('upload_url', '/assets/uploads');


	// nconf defaults, if not set in config
	if (!nconf.get('sessionKey')) {
		nconf.set('sessionKey', 'express.sid');
	}

	if (nconf.get('url')) {
		nconf.set('url_parsed', url.parse(nconf.get('url')));
		// Parse out the relative_url and other goodies from the configured URL
		const urlObject = url.parse(nconf.get('url'));
		const relativePath = urlObject.pathname !== '/' ? urlObject.pathname.replace(/\/+$/, '') : '';
		nconf.set('base_url', urlObject.protocol + '//' + urlObject.host);
		nconf.set('secure', urlObject.protocol === 'https:');
		nconf.set('use_port', !!urlObject.port);
		nconf.set('relative_path', relativePath);
		nconf.set('port', nconf.get('PORT') || nconf.get('port') || urlObject.port || (nconf.get('PORT_ENV_VAR') ? nconf.get(nconf.get('PORT_ENV_VAR')) : false) || 4567);

		// cookies don't provide isolation by port: http://stackoverflow.com/a/16328399/122353
		const domain = nconf.get('cookieDomain') || urlObject.hostname;
		const origins = nconf.get('socket.io:origins') || `${urlObject.protocol}//${domain}:*`;
		nconf.set('socket.io:origins', origins);
	}
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
