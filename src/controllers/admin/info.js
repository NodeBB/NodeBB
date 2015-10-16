'use strict';

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
		}
	};

	res.render('admin/development/info', {info: JSON.stringify(data, null, 4)});
};


module.exports = infoController;