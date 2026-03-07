'use strict';

const nconf = require('nconf');
const { CronJob } = require('cron');
const cronstrue = require('cronstrue');
const winston = require('winston');

const db = require('./database');
const utils = require('./utils');

const jobs = Object.create(null);

exports.deleteJobs = async function () {
	const jobs = await db.getSortedSetRange('cronJobs', 0, -1);
	await db.deleteAll(jobs.map(name => `cronJob:${name}`));
	await db.delete('cronJobs');
};

exports.addJob = async function (options) {
	const {
		name,
		cronTime,
		onTick,
		onComplete = null,
		start = true,
		runOnInit = false,
		runOnAllNodes = false,
	} = options;

	const isJobEnabled = nconf.get('runJobs');

	if (!isJobEnabled && !runOnAllNodes) {
		return;
	}

	if (!name || !cronTime || typeof onTick !== 'function') {
		throw new Error('[cron] Invalid options');
	}
	if (Object.hasOwn(jobs, name)) {
		throw new Error('[cron] Job with that name already exists');
	}

	const job = new CronJob(cronTime, async function () {
		const start = Date.now();
		try {
			await db.setObjectField(`cronJob:${name}`, 'running', 1);
			await onTick();
			await db.deleteObjectField(`cronJob:${name}`, 'lastError');
		} catch (err) {
			winston.error(`[cron] ${err.stack}`);
			await db.setObjectField(`cronJob:${name}`, 'lastError', err.stack);
		} finally {
			await db.setObject(`cronJob:${name}`, {
				running: 0,
				duration: Date.now() - start,
				nextRun: job.nextDate().toMillis(),
			});
		}
	}, onComplete, start, null, null, runOnInit);

	jobs[name] = job;

	await db.sortedSetAdd('cronJobs', Date.now(), name);
	await db.setObject(`cronJob:${name}`, {
		name,
		cronTime,
		cronTimeHuman: cronstrue.toString(cronTime),
		nextRun: job.nextDate().toMillis(),
		running: runOnInit ? 1 : 0,
	});
	winston.verbose(`[cron/jobs] Registered job: ${name} (${cronTime})`);
	return job;
};

exports.getJobs = async function () {
	const jobNames = await db.getSortedSetRange('cronJobs', 0, -1);
	const jobs = await db.getObjects(jobNames.map(name => `cronJob:${name}`));
	jobs.forEach((job) => {
		if (job) {
			job.running = parseInt(job.running, 10) === 1;
			job.duration = job.duration || 0;
			job.durationReadable = formatDuration(job.duration);
			job.nextRunISO = utils.toISOString(job.nextRun);
		}
	});
	jobs.sort((a, b) => b.cronTimeHuman.localeCompare(a.cronTimeHuman));
	return jobs;
};

function formatDuration(ms) {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}m${String(seconds).padStart(2, '0')}s`;
	}
	return `${seconds}s`;
}
