'use strict';

const os = require('os');
const winston = require('winston');
const nconf = require('nconf');
const { exec } = require('child_process');

const pubsub = require('../../pubsub');
const rooms = require('../../socket.io/admin/rooms');

const infoController = module.exports;

let info = {};
let previousUsage = process.cpuUsage();
let usageStartDate = Date.now();

infoController.get = function (req, res) {
	info = {};
	pubsub.publish('sync:node:info:start');
	const timeoutMS = 1000;
	setTimeout(() => {
		const data = [];
		Object.keys(info).forEach(key => data.push(info[key]));
		data.sort((a, b) => {
			if (a.id < b.id) {
				return -1;
			}
			if (a.id > b.id) {
				return 1;
			}
			return 0;
		});

		let port = nconf.get('port');
		if (!Array.isArray(port) && !isNaN(parseInt(port, 10))) {
			port = [port];
		}

		res.render('admin/development/info', {
			info: data,
			infoJSON: JSON.stringify(data, null, 4),
			host: os.hostname(),
			port: port,
			nodeCount: data.length,
			timeout: timeoutMS,
			ip: req.ip,
		});
	}, timeoutMS);
};

pubsub.on('sync:node:info:start', async () => {
	try {
		const data = await getNodeInfo();
		data.id = `${os.hostname()}:${nconf.get('port')}`;
		pubsub.publish('sync:node:info:end', { data: data, id: data.id });
	} catch (err) {
		winston.error(err.stack);
	}
});

pubsub.on('sync:node:info:end', (data) => {
	info[data.id] = data.data;
});

async function getNodeInfo() {
	const data = {
		process: {
			port: nconf.get('port'),
			pid: process.pid,
			title: process.title,
			version: process.version,
			memoryUsage: process.memoryUsage(),
			uptime: process.uptime(),
			cpuUsage: getCpuUsage(),
		},
		os: {
			hostname: os.hostname(),
			type: os.type(),
			platform: os.platform(),
			arch: os.arch(),
			release: os.release(),
			load: os.loadavg().map(load => load.toFixed(2)).join(', '),
			freemem: os.freemem(),
			totalmem: os.totalmem(),
		},
		nodebb: {
			isCluster: nconf.get('isCluster'),
			isPrimary: nconf.get('isPrimary'),
			runJobs: nconf.get('runJobs'),
			jobsDisabled: nconf.get('jobsDisabled'),
		},
	};

	data.process.memoryUsage.humanReadable = (data.process.memoryUsage.rss / (1024 * 1024 * 1024)).toFixed(3);
	data.process.uptimeHumanReadable = humanReadableUptime(data.process.uptime);
	data.os.freemem = (data.os.freemem / (1024 * 1024 * 1024)).toFixed(2);
	data.os.totalmem = (data.os.totalmem / (1024 * 1024 * 1024)).toFixed(2);
	data.os.usedmem = (data.os.totalmem - data.os.freemem).toFixed(2);
	const [stats, gitInfo] = await Promise.all([
		rooms.getLocalStats(),
		getGitInfo(),
	]);
	data.git = gitInfo;
	data.stats = stats;
	return data;
}

function getCpuUsage() {
	const newUsage = process.cpuUsage();
	const diff = (newUsage.user + newUsage.system) - (previousUsage.user + previousUsage.system);
	const now = Date.now();
	const result = diff / ((now - usageStartDate) * 1000) * 100;
	previousUsage = newUsage;
	usageStartDate = now;
	return result.toFixed(2);
}

function humanReadableUptime(seconds) {
	if (seconds < 60) {
		return `${Math.floor(seconds)}s`;
	} else if (seconds < 3600) {
		return `${Math.floor(seconds / 60)}m`;
	} else if (seconds < 3600 * 24) {
		return `${Math.floor(seconds / (60 * 60))}h`;
	}
	return `${Math.floor(seconds / (60 * 60 * 24))}d`;
}

async function getGitInfo() {
	function get(cmd, callback) {
		exec(cmd, (err, stdout) => {
			if (err) {
				winston.error(err.stack);
			}
			callback(null, stdout ? stdout.replace(/\n$/, '') : 'no-git-info');
		});
	}
	const getAsync = require('util').promisify(get);
	const [hash, branch] = await Promise.all([
		getAsync('git rev-parse HEAD'),
		getAsync('git rev-parse --abbrev-ref HEAD'),
	]);
	return { hash: hash, hashShort: hash.slice(0, 6), branch: branch };
}
