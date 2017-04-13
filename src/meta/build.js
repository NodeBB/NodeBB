'use strict';

var async = require('async');
var winston = require('winston');
var os = require('os');
var nconf = require('nconf');
var padstart = require('lodash.padstart');

var cacheBuster = require('./cacheBuster');
var db = require('../database');
var meta = require('../meta');
var plugins = require('../plugins');

function step(target, callback) {
	var startTime = Date.now();
	winston.info('[build] ' + target + ' build started');

	return function (err) {
		if (err) {
			winston.error('Build failed: ' + err.stack);
			return callback(err);
		}

		var time = (Date.now() - startTime) / 1000;

		winston.info('[build] ' + target + ' build completed in ' + time + 'sec');
		callback();
	};
}

var targetHandlers = {
	javascript: function (parallel, callback) {
		var all = parallel ? async.parallel : async.series;

		all([
			function (next) {
				meta.js.linkStatics(next);
			},
			function (next) {
				meta.js.buildModules(parallel, next);
			},
			function (next) {
				meta.js.buildBundle('client', parallel, next);
			},
			function (next) {
				meta.js.buildBundle('admin', parallel, next);
			},
		], callback);
	},
	'client side styles': function (parallel, callback) {
		meta.css.buildBundle('client', parallel, callback);
	},
	'admin control panel styles': function (parallel, callback) {
		meta.css.buildBundle('admin', parallel, callback);
	},
	styles: function (parallel, callback) {
		var all = parallel ? async.each : async.eachSeries;

		all(['client', 'admin'], function (target, next) {
			meta.css.buildBundle(target, parallel, step(target, next));
		}, callback);
	},
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
	async.series([
		async.apply(db.init),
		async.apply(meta.themes.setupPaths),
		async.apply(plugins.prepareForBuild),
	], function (err) {
		if (err) {
			winston.error('[build] Encountered error preparing for build: ' + err.message);
			return callback(err);
		}

		callback();
	});
}

var all = Object.keys(targetHandlers).filter(function (name) {
	return name !== 'styles';
});
function buildTargets(targets, parallel, callback) {
	var all = parallel ? async.parallel : async.series;

	var length = Math.max.apply(Math, targets.map(function (name) {
		return name.length;
	}));

	all(targets.map(function (target) {
		return function (next) {
			targetHandlers[target](parallel, step(padstart(target, length) + ' ', next));
		};
	}), callback);
}

function build(targets, callback) {
	if (targets === true) {
		targets = all;
	} else if (!Array.isArray(targets)) {
		targets = targets.split(',');
	}

	targets = targets.map(function (target) {
		target = target.toLowerCase().replace(/-/g, '');
		if (!aliases[target]) {
			winston.warn('[build] Unknown target: ' + target);
			return false;
		}

		return aliases[target];
	}).filter(Boolean);

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
			var threads = Math.max(os.cpus().length, nconf.get('threads') || 0);
			var parallel = targets.length > 1 && threads > 1;
			if (parallel) {
				winston.info('[build] Building in multi-thread mode');
			} else {
				winston.info('[build] Building in single-thread mode');
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
	build(all, callback);
};
