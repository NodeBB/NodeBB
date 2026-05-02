'use strict';

const nconf = require('nconf');
const winston = require('winston');
const crypto = require('crypto');

const request = require('../request');
const cron = require('../cron');
const pkg = require('../../package.json');

const meta = require('../meta');

module.exports = function (Plugins) {
	Plugins.startJobs = async function () {
		await cron.addJob({
			name: 'plugins:submitUsageData',
			cronTime: '0 0 0 * * *',
			onTick: Plugins.submitUsageData,
		});
	};

	Plugins.submitUsageData = async function () {
		if (!meta.config.submitPluginUsage || !Plugins.loadedPlugins.length || process.env.NODE_ENV !== 'production') {
			return;
		}

		const hash = crypto.createHash('sha256');
		hash.update(nconf.get('url'));
		const url = `${nconf.get('registry') || 'https://packages.nodebb.org'}/api/v1/plugin/usage`;
		try {
			const { response, body } = await request.post(url, {
				body: {
					id: hash.digest('hex'),
					version: pkg.version,
					plugins: Plugins.loadedPlugins,
				},
				timeout: 5000,
			});

			if (!response.ok) {
				winston.error(`[plugins.submitUsageData] received ${response.status} ${body}`);
			}
		} catch (err) {
			winston.error(err.stack);
		}
	};
};
