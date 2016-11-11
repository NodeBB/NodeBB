'use strict';

var async = require('async');
var os = require('os');
var winston = require('winston');
var nconf = require('nconf');
var exec = require('child_process').exec;

var pubsub = require('../../pubsub');
var rooms = require('../../socket.io/admin/rooms');

var infoController = {};

var info = {};

infoController.get = function (req, res, next) {
	info = {};
	pubsub.publish('sync:node:info:start');
	setTimeout(function () {
		var data = [];
		Object.keys(info).forEach(function (key) {
			data.push(info[key]);
		});
		data.sort(function (a, b) {
			return (a.os.hostname < b.os.hostname) ? -1 : (a.os.hostname > b.os.hostname) ? 1 : 0;
		});
		res.render('admin/development/info', {info: data, infoJSON: JSON.stringify(data, null, 4), host: os.hostname(), port: nconf.get('port')});
	}, 500);
};

pubsub.on('sync:node:info:start', function () {
	getNodeInfo(function (err, data) {
		if (err) {
			return winston.error(err);
		}
		pubsub.publish('sync:node:info:end', {data: data, id: os.hostname() + ':' + nconf.get('port')});
	});
});

pubsub.on('sync:node:info:end', function (data) {
	info[data.id] = data.data;
});

function getNodeInfo(callback) {
	var data = {
		process: {
			port: nconf.get('port'),
			pid: process.pid,
			title: process.title,
			version: process.version,
			memoryUsage: process.memoryUsage(),
			uptime: process.uptime()
		},
		os: {
			hostname: os.hostname(),
			type: os.type(),
			platform: os.platform(),
			arch: os.arch(),
			release: os.release(),
			load: os.loadavg().map(function (load) { return load.toFixed(2); }).join(', ')
		}
	};

	async.parallel({
		stats: function (next) {
			rooms.getLocalStats(next);
		},
		gitInfo: function (next) {
			getGitInfo(next);
		}
	}, function (err, results) {
		if (err) {
			return callback(err);
		}
		data.git = results.gitInfo;
		data.stats = results.stats;
		callback(null, data);
	});
}

function getGitInfo(callback) {
	function get(cmd,  callback) {
		exec(cmd, function (err, stdout) {
			if (err) {
				winston.error(err);
			}
			callback(null, stdout ? stdout.replace(/\n$/, '') : 'no-git-info');
		});
	}
	async.parallel({
		hash: function (next) {
			get('git rev-parse HEAD', next);
		},
		branch: function (next) {
			get('git rev-parse --abbrev-ref HEAD', next);
		}
	}, callback);
}

module.exports = infoController;