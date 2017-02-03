'use strict';

var async = require('async');
var winston = require('winston');

var buildStart;

var valid = ['js', 'clientCSS', 'acpCSS', 'tpl', 'lang'];

exports.buildAll = function (callback) {
	exports.build(valid.join(','), callback);
};

exports.build = function build(targets, callback) {
	buildStart = Date.now();

	var db = require('../database');
	var meta = require('../meta');
	var plugins = require('../plugins');


	targets = (targets === true ? valid : targets.split(',').filter(function (target) {
		return valid.indexOf(target) !== -1;
	}));

	if (!targets) {
		winston.error('[build] No valid build targets found. Aborting.');
		return process.exit(0);
	}

	async.series([
		async.apply(db.init),
		async.apply(meta.themes.setupPaths),
		async.apply(plugins.prepareForBuild)
	], function (err) {
		if (err) {
			winston.error('[build] Encountered error preparing for build: ' + err.message);
			return process.exit(1);
		}

		exports.buildTargets(targets, callback);
	});
};

exports.buildTargets = function (targets, callback) {
	var cacheBuster = require('./cacheBuster');
	var meta = require('../meta');
	buildStart = buildStart || Date.now();

	var step = function (startTime, target, next, err) {
		if (err) {
			winston.error('Build failed: ' + err.message);
			process.exit(1);
		}
		winston.info('[build] ' + target + ' => Completed in ' + ((Date.now() - startTime) / 1000) + 's');
		next();
	};

	async.parallel([
		function (next) {
			if (targets.indexOf('js') !== -1) {
				winston.info('[build] Building javascript');
				var startTime = Date.now();
				async.series([
					meta.js.linkModules,
					meta.js.linkStatics,
					async.apply(meta.js.minify, 'nodebb.min.js'),
					async.apply(meta.js.minify, 'acp.min.js')
				], step.bind(this, startTime, 'js', next));
			} else {
				setImmediate(next);
			}
		},
		function (next) {
			async.eachSeries(targets, function (target, next) {
				var startTime;
				switch(target) {
					case 'js':
						setImmediate(next);
						break;
					case 'clientCSS':
						winston.info('[build] Building client-side CSS');
						startTime = Date.now();
						meta.css.minify('client', step.bind(this, startTime, target, next));
						break;

					case 'acpCSS':
						winston.info('[build] Building admin control panel CSS');
						startTime = Date.now();
						meta.css.minify('admin', step.bind(this, startTime, target, next));
						break;

					case 'tpl':
						winston.info('[build] Building templates');
						startTime = Date.now();
						meta.templates.compile(step.bind(this, startTime, target, next));
						break;
					
					case 'lang':
						winston.info('[build] Building language files');
						startTime = Date.now();
						meta.languages.build(step.bind(this, startTime, target, next));
						break;

					default:
						winston.warn('[build] Unknown build target: \'' + target + '\'');
						setImmediate(next);
						break;
				}
			}, next);
		}
	], function (err) {
		if (err) {
			winston.error('[build] Encountered error during build step: ' + err.message);
			return process.exit(1);
		}

		cacheBuster.write(function (err) {
			if (err) {
				winston.error('[build] Failed to write `cache-buster.conf`: ' + err.message);
				return process.exit(1);
			}

			var time = (Date.now() - buildStart) / 1000;

			winston.info('[build] Asset compilation successful. Completed in ' + time + 's.');

			if (typeof callback === 'function') {
				callback();
			} else {
				process.exit(0);
			}
		});
	});
};