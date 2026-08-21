'use strict';

const os = require('os');
const path = require('path');
const winston = require('winston');
const workerpool = require('workerpool');

const db = require('../database');

// ---------------------------------------------------------------------------
// Worker pool — managed by workerpool
// ---------------------------------------------------------------------------

const SendPool = {
	_activityPub: null,
};

SendPool._pool = workerpool.pool(
	path.join(__dirname, 'sendWorker.js'),
	{
		minWorkers: Math.max(4, os.availableParallelism() * 2),
		maxWorkers: Math.max(4, os.availableParallelism() * 2),
		workerType: 'process',
		forkOpts: { silent: true },
	},
);

Object.defineProperty(SendPool, 'pool', {
	get() {
		return this._pool?.workers?.length || 0;
	},
});

SendPool.init = function (activityPub) {
	if (activityPub) {
		SendPool._activityPub = activityPub;
	}
};

// ---------------------------------------------------------------------------
// Result handler — called after worker completes a task
// ---------------------------------------------------------------------------

SendPool.handleResult = function (queueId, result) {
	if (result.success) {
		// Success — fire analytics and remove from Redis
		SendPool._activityPub.analytics.send({
			type: result.payloadType,
			target: result.uri,
		});
		db.delete(`ap:retry:queue:${queueId}`);
		db.sortedSetRemove('ap:retry:queue', queueId);
	} else {
		try {
			SendPool._activityPub.analytics.sendError({
				payload: JSON.parse(result.payload),
				uri: result.uri,
				error: new Error(result.error),
			});
		} catch (e) {
			winston.warn(`[activitypub/send] Task failed: ${result.error}`);
		}
	}
};

// ---------------------------------------------------------------------------
// Retry queue — exponential backoff into Redis
// ---------------------------------------------------------------------------

SendPool.requeueTask = function (task) {
	const oneMinute = 1000 * 60;
	const maxDelay = 60 * 60 * 1000; // 1 hour

	const attempts = task.attempts || 1;
	const backoffMs = Math.min(
		oneMinute * Math.pow(2, attempts - 1),
		maxDelay,
	);

	task.attempts = attempts + 1;
	task.timestamp = Date.now() + backoffMs;

	const nextTryOn = task.timestamp;
	const retryQueueAdd = [];
	const retryQueuedSet = [];

	retryQueueAdd.push(['ap:retry:queue', nextTryOn, task.queueId]);
	retryQueuedSet.push([`ap:retry:queue:${task.queueId}`, {
		queueId: task.queueId,
		uri: task.uri,
		id: task.id,
		type: task.payloadType,
		attempts: task.attempts,
		timestamp: nextTryOn,
		digest: task.digest,
		payload: task.payload,
	}]);

	db.sortedSetAddBulk(retryQueueAdd);
	db.setObjectBulk(retryQueuedSet);
};

// ---------------------------------------------------------------------------
// Dispatch — send task to workerpool
// ---------------------------------------------------------------------------

SendPool.dispatch = function (task) {
	// workerpool handles queuing automatically when all workers are busy.
	// The 30s timeout on exec kills the worker and rejects the promise,
	// which is caught by drainLoop and triggers re-queuing.
	return SendPool._pool.exec('send', [{
		id: task.id,
		uri: task.uri,
		payload: task.payload,
		digest: task.digest,
		key: task.key,
		keyId: task.keyId,
	}], { timeout: 30000 })
		.then(result => result)
		.catch(e => ({ success: false, error: e.message }));
};

// ---------------------------------------------------------------------------
// Drain loop — fetch due tasks from Redis and dispatch
// ---------------------------------------------------------------------------

SendPool.drainLoop = async function () {
	if (SendPool._draining) {
		return;
	}
	SendPool._draining = true;
	SendPool._inFlight = SendPool._inFlight || new Set();

	const MAX_PER_BATCH = 50;

	while (SendPool._draining) {
		try {
			// Get due tasks from Redis sorted set
			const dueTasks = await db.getSortedSetRangeByScore(
				'ap:retry:queue',
				0,
				MAX_PER_BATCH,
				'-inf',
				Date.now(),
			);

			if (dueTasks.length === 0) {
				// No tasks due — switch to idle mode
				SendPool._draining = false;
				setTimeout(() => {
					if (SendPool.pool > 0) {
						SendPool.drainLoop();
					}
				}, 10000); // 10-second idle timeout
				return;
			}

			// Batch fetch task data to avoid await inside loop
			const taskDataList = await Promise.all(
				dueTasks.map(queueId => db.getObject(`ap:retry:queue:${queueId}`)),
			);

			// Pair each queueId with its own task data and skip in-flight or
			// missing tasks
			const validTaskData = [];
			for (let i = 0; i < dueTasks.length; i++) {
				const queueId = dueTasks[i];
				const taskData = taskDataList[i];
				if (taskData && !SendPool._inFlight.has(queueId)) {
					validTaskData.push({ queueId, taskData });
				}
			}

			// Fetch all key data in parallel
			const keyPromises = validTaskData.map(({ taskData }) => (
				SendPool._activityPub.getPrivateKey(taskData.type, taskData.id)
			));
			const keyResults = await Promise.all(keyPromises);

			// Dispatch each task to workerpool (auto-queues if busy)
			for (let i = 0; i < validTaskData.length; i++) {
				const { queueId, taskData } = validTaskData[i];
				const keyData = keyResults[i];

				const task = {
					queueId,
					uri: taskData.uri,
					id: taskData.id,
					payloadType: taskData.type,
					payload: taskData.payload,
					digest: taskData.digest,
					key: keyData.key,
					keyId: keyData.keyId,
					attempts: taskData.attempts || 1,
				};

				SendPool._inFlight.add(task.queueId);

				SendPool.dispatch(task)
					.then((result) => {
						SendPool._inFlight.delete(task.queueId);
						if (result.success) {
							SendPool.handleResult(queueId, {
								...task,
								success: true,
							});
						} else {
							SendPool.handleResult(queueId, {
								...task,
								success: false,
								error: result.error,
							});
							SendPool.requeueTask(task);
						}
					})
					.catch((e) => {
						// Exec rejected (e.g., worker crash, queue full)
						SendPool._inFlight.delete(task.queueId);
						SendPool.handleResult(queueId, {
							...task,
							success: false,
							error: e.message || 'unknown error',
						});
						SendPool.requeueTask(task);
					});
			}

			// Yield to event loop between batches to prevent starvation
			if (dueTasks.length >= MAX_PER_BATCH) {
				setImmediate(() => {
					if (SendPool.pool > 0) {
						SendPool.drainLoop();
					}
				});
			}
		} catch (e) {
			winston.error(`[activitypub/send] drainLoop error: ${e.message}`);
			SendPool._draining = false;
			// Schedule retry after a delay
			setTimeout(() => {
				if (SendPool.pool > 0) {
					SendPool.drainLoop();
				}
			}, 10000);
		}
	}
};

// ---------------------------------------------------------------------------
// Shutdown — graceful termination with force-fallback
// ---------------------------------------------------------------------------

SendPool.shutdown = function () {
	SendPool._draining = false;

	// Graceful shutdown — let workers finish current tasks
	SendPool._pool.terminate(false, 10000).catch(() => {
		winston.warn('[activitypub/send] Workers did not exit gracefully');
	});

	// Force kill workers if they haven't exited within the timeout
	setTimeout(() => {
		SendPool._pool.terminate(true, 10000).catch(() => {
			winston.warn('[activitypub/send] Force shutdown failed');
		});
	}, 12000);
};

module.exports = SendPool;
