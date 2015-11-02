'use strict';

var async = require('async');
var os = require('os');
var exec = require('child_process').exec;

var infoController = {};

infoController.get = function(req, res, next) {

	var data = {
		process: {
			pid: process.pid,
			title: process.title,
			arch: process.arch,
			platform: process.platform,
			version: process.version,
			versions: process.versions,
			memoryUsage: process.memoryUsage(),
			uptime: process.uptime()
		},
		os: {
			hostname: os.hostname(),
			type: os.type(),
			platform: os.platform(),
			arch: os.arch(),
			release: os.release()
		}
	};
	getGitInfo(function(err, gitInfo) {
		if (err) {
			return next(err);
		}
		data.git = gitInfo;
		res.render('admin/development/info', {info: JSON.stringify(data, null, 4)});
	});
};

function getGitInfo(callback) {
	function get(cmd,  callback) {
		exec(cmd, function(err, stdout) {
			callback(err, stdout ? stdout.replace(/\n$/, '') : '');
		});
	}
	async.parallel({
		hash: function(next) {
			get('git rev-parse HEAD', next);
		},
		branch: function(next) {
			get('git rev-parse --abbrev-ref HEAD', next);
		}
	}, callback);
}

module.exports = infoController;