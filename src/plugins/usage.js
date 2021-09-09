'use strict';

const nconf = require('nconf');
const request = require('request');
const winston = require('winston');
const crypto = require('crypto');
const cronJob = require('cron').CronJob;

const pkg = require('../../package.json');

const meta = require('../meta');

module.exports = function (Plugins) {
	Plugins.startJobs = function () {
		new cronJob('0 0 0 * * *', function () {
			Plugins.submitUsageData();
		}, null, true);
	};

	Plugins.submitUsageData = function () {
		if (!meta.config.submitPluginUsage || !Plugins.loadedPlugins.length || global.env !== 'production') {
			return;
		}

		const hash = crypto.createHash('sha256');
		hash.update(nconf.get('url'));
		request.post((nconf.get('registry') || 'https://packages.nodebb.org') + '/api/v1/plugin/usage', {
			form: {
				id: hash.digest('hex'),
				version: pkg.version,
				plugins: Plugins.loadedPlugins,
			},
			timeout: 5000,
		}, function (err, res, body) {
			if (err) {
				return winston.error(err.stack);
			}
			if (res.statusCode !== 200) {
				winston.error('[plugins.submitUsageData] received ' + res.statusCode + ' ' + body);
			}
		});
	};
};
