'use strict';

var async = require('async');
var winston = require('winston');
var nconf = require('nconf');
var padstart = require('lodash.padstart');

var cacheBuster = require('./cacheBuster');
var meta;

function step(target, callback) {
	var startTime = Date.now();
	winston.info('[build] ' + target + ' build started');

	return function (err) {
		if (err) {
			winston.error('[build] ' + target + ' build failed');
			return callback(err);
		}

		var time = (Date.now() - startTime) / 1000;

		winston.info('[build] ' + target + ' build completed in ' + time + 'sec');
		callback();
	};
}

var targetHandlers = {
	'plugin static dirs': function (parallel, callback) {
		meta.js.linkStatics(callback);
	},
	'requirejs modules': function (parallel, callback) {
		meta.js.buildModules(parallel, callback);
	},
	'client js bundle': function (parallel, callback) {
		meta.js.buildBundle('client', parallel, callback);
	},
	'admin js bundle': function (parallel, callback) {
		meta.js.buildBundle('admin', parallel, callback);
	},
	javascript: [
		'plugin static dirs',
		'requirejs modules',
		'client js bundle',
		'admin js bundle',
	],
	'client side styles': function (parallel, callback) {
		meta.css.buildBundle('client', parallel, callback);
	},
	'admin control panel styles': function (parallel, callback) {
		meta.css.buildBundle('admin', parallel, callback);
	},
	styles: [
		'client side styles',
		'admin control panel styles',
	],
	templates: function (parallel, callback) {
		meta.templates.compile(callback);
	},
	languages: function (parallel, callback) {
		meta.languages.build(callback);
	},
	sounds: function (parallel, callback) {
		meta.sounds.build(callback);
	},
};

var aliases = {
	'plugin static dirs': ['staticdirs'],
	'requirejs modules': ['rjs', 'modules'],
	'client js bundle': ['clientjs', 'clientscript', 'clientscripts'],
	'admin js bundle': ['adminjs', 'adminscript', 'adminscripts'],
	javascript: ['js'],
	'client side styles': [
		'clientcss', 'clientless', 'clientstyles', 'clientstyle',
	],
	'admin control panel styles': [
		'admincss', 'adminless', 'adminstyles', 'adminstyle', 'acpcss', 'acpless', 'acpstyles', 'acpstyle',
	],
	styles: ['css', 'less', 'style'],
	templates: ['tpl'],
	languages: ['lang', 'i18n'],
	sounds: ['sound'],
};

aliases = Object.keys(aliases).reduce(function (prev, key) {
	var arr = aliases[key];
	arr.forEach(function (alias) {
		prev[alias] = key;
	});
	prev[key] = key;
	return prev;
}, {});

function beforeBuild(callback) {
	var db = require('../database');
	var plugins = require('../plugins');
	meta = require('../meta');

	async.series([
		db.init,
		meta.themes.setupPaths,
		plugins.prepareForBuild,
	], function (err) {
		if (err) {
			winston.error('[build] Encountered error preparing for build: ' + err.message);
			return callback(err);
		}

		callback();
	});
}

var allTargets = Object.keys(targetHandlers).filter(function (name) {
	return typeof targetHandlers[name] === 'function';
});
function buildTargets(targets, parallel, callback) {
	var all = parallel ? async.each : async.eachSeries;

	var length = Math.max.apply(Math, targets.map(function (name) {
		return name.length;
	}));

	all(targets, function (target, next) {
		targetHandlers[target](parallel, step(padstart(target, length) + ' ', next));
	}, callback);
}

function build(targets, callback) {
	if (targets === true) {
		targets = allTargets;
	} else if (!Array.isArray(targets)) {
		targets = targets.split(',');
	}

	targets = targets
		// get full target name
		.map(function (target) {
			target = target.toLowerCase().replace(/-/g, '');
			if (!aliases[target]) {
				winston.warn('[build] Unknown target: ' + target);
				return false;
			}

			return aliases[target];
		})
		// filter nonexistent targets
		.filter(Boolean)
		// map multitargets to their sets
		.reduce(function (prev, target) {
			if (Array.isArray(targetHandlers[target])) {
				return prev.concat(targetHandlers[target]);
			}

			return prev.concat(target);
		}, [])
		// unique
		.filter(function (target, i, arr) {
			return arr.indexOf(target) === i;
		});

	if (typeof callback !== 'function') {
		callback = function (err) {
			if (err) {
				winston.error(err);
				process.exit(1);
			} else {
				process.exit(0);
			}
		};
	}

	if (!targets) {
		winston.info('[build] No valid targets supplied. Aborting.');
		callback();
	}

	var startTime;
	var totalTime;
	async.series([
		beforeBuild,
		function (next) {
			var parallel = !nconf.get('series');
			if (parallel) {
				winston.info('[build] Building in parallel mode');
			} else {
				winston.info('[build] Building in series mode');
			}

			startTime = Date.now();
			buildTargets(targets, parallel, next);
		},
		function (next) {
			totalTime = (Date.now() - startTime) / 1000;
			cacheBuster.write(next);
		},
	], function (err) {
		if (err) {
			winston.error('[build] Encountered error during build step: ' + err.message);
			return callback(err);
		}

		winston.info('[build] Asset compilation successful. Completed in ' + totalTime + 'sec.');
		callback();
	});
}

exports.build = build;

exports.buildAll = function (callback) {
	build(allTargets, callback);
};
