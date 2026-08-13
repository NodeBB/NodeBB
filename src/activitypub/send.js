'use strict';

const os = require('os');
const path = require('path');
const { fork } = require('child_process');
const { createHash } = require('crypto');
const winston = require('winston');

const db = require('../database');

// ---------------------------------------------------------------------------
// SendPool — worker pool management for outbound federation
// ---------------------------------------------------------------------------

const SendPool = {
	pool: [],
	free: [],
	busy: new Map(),
	pending: new Map(),
	taskTimers: new Map(),
	inFlight: new Set(),
	draining: false,
	isShuttingDown: false,
	maxWorkers: 0,
};

SendPool.maxWorkers = Math.max(1, os.cpus().length - 1);

/**
 * Initialize the send pool — fork workers and wait for ready signals.
 */
SendPool.init = function (activityPub) {
	if (activityPub) {
		SendPool._activityPub = activityPub;
	}
	for (let i = 0; i < SendPool.maxWorkers; i++) {
		SendPool.forkWorker();
	}
};

/**
 * Fork a new worker process and set up message/exit handlers.
 */
SendPool.forkWorker = function () {
	const workerPath = path.join(__dirname, 'sendWorker.js');
	const proc = fork(workerPath, [], {
		silent: true,
		env: { AP_SEND_CHILD: 'true' },
	});

	proc.once('exit', (code) => {
		SendPool.handleWorkerExit(proc, code);
	});

	proc.on('message', (message) => {
		if (!message || typeof message.type !== 'string') {
			return;
		}

		switch (message.type) {
			case 'ready': {
				// Worker is ready to accept tasks
				if (!SendPool.free.includes(proc)) {
					SendPool.free.push(proc);
				}
				break;
			}

			case 'result': {
				SendPool.handleResult(message);
				break;
			}

			case 'ack': {
				// Shutdown acknowledged — worker will exit
				break;
			}

			default:
				winston.warn(`[activitypub/send] Unknown worker message: ${message.type}`);
				break;
		}
	});

	proc.on('error', (err) => {
		winston.error(`[activitypub/send] Worker error: ${err.message}`);
	});

	SendPool.pool.push(proc);
};

/**
 * Handle worker exit — re-queue in-flight task if any.
 */
SendPool.handleWorkerExit = function (proc, code) {
	winston.warn(`[activitypub/send] Worker exited with code ${code}`);

	// Remove from pool and free arrays
	const poolIdx = SendPool.pool.indexOf(proc);
	if (poolIdx !== -1) {
		SendPool.pool.splice(poolIdx, 1);
	}
	const freeIdx = SendPool.free.indexOf(proc);
	if (freeIdx !== -1) {
		SendPool.free.splice(freeIdx, 1);
	}

	// Re-queue in-flight task if this worker had one
	const taskId = SendPool.busy.get(proc);
	if (taskId) {
		const task = SendPool.pending.get(taskId);
		if (task) {
			// Re-queue immediately — the worker crashed mid-flight
			SendPool.requeueTask(task);
		}
		SendPool.busy.delete(proc);
		SendPool.pending.delete(taskId);
		SendPool.clearTaskTimer(taskId);
		SendPool.inFlight.delete(task.queueId);
	}

	// Fork a replacement worker only if not shutting down
	if (!SendPool.isShuttingDown) {
		SendPool.forkWorker();
	}
};

/**
 * Handle a result from a worker — analytics on success, re-queue on failure.
 */
SendPool.handleResult = function (message) {
	const { id, success, error } = message;
	const task = SendPool.pending.get(id);

	// Clear the stuck-task timer
	SendPool.clearTaskTimer(id);

	// Remove from pending and busy tracking
	SendPool.pending.delete(id);

	if (!task) {
		return;
	}

	// Find which worker handled this task, mark it free, and return to pool
	for (const [worker, taskId] of SendPool.busy) {
		if (taskId === id) {
			SendPool.busy.delete(worker);
			if (!SendPool.free.includes(worker)) {
				SendPool.free.push(worker);
			}
			break;
		}
	}

	if (success) {
		// Success — fire analytics and remove from Redis
		SendPool._activityPub.analytics.send({
			type: task.payloadType,
			target: task.uri,
		});
		db.delete(`ap:retry:queue:${task.queueId}`);
		db.sortedSetRemove('ap:retry:queue', task.queueId);
		SendPool.inFlight.delete(task.queueId);
	} else {
		// Failure — re-queue with backoff
		winston.warn(`[activitypub/send] Task ${id} failed: ${error}`);
		SendPool.requeueTask(task);
	}
};

/**
 * Re-queue a task to the Redis retry queue with exponential backoff.
 */
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

/**
 * Clear the stuck-task timer for a task.
 */
SendPool.clearTaskTimer = function (taskId) {
	const timer = SendPool.taskTimers.get(taskId);
	if (timer) {
		clearTimeout(timer);
		SendPool.taskTimers.delete(taskId);
	}
};

/**
 * Dispatch a task to an available worker.
 */
SendPool.dispatch = function (taskId, task) {
	if (SendPool.free.length === 0) {
		// No free workers — task stays in pending queue
		return false;
	}

	const worker = SendPool.free.shift();
	SendPool.busy.set(worker, taskId);

	// Set 30s stuck detection timer
	const timer = setTimeout(() => {
		// Task has been in-flight for >30s — re-queue and kill worker
		SendPool.clearTaskTimer(taskId);
		SendPool.pending.delete(taskId);
		SendPool.requeueTask(task);
		worker.kill('SIGKILL');
	}, 30000);
	SendPool.taskTimers.set(taskId, timer);

	try {
		worker.send({
			type: 'send',
			id: taskId,
			uri: task.uri,
			payload: task.payload,
			digest: task.digest,
			key: task.key,
			keyId: task.keyId,
		});
	} catch (err) {
		// Worker disconnected — kill it, re-queue task
		SendPool.busy.delete(worker);
		SendPool.pending.delete(taskId);
		SendPool.inFlight.delete(task.queueId);
		SendPool.clearTaskTimer(taskId);
		SendPool.requeueTask(task);
		try {
			worker.kill('SIGKILL');
		} catch (e) { /* already dead */ }
	}

	return true;
};

/**
 * Drain loop — dispatch tasks from Redis queue to available workers.
 * Active mode: tight loop with setImmediate yield between batches.
 * Idle mode: 10-second setTimeout before checking again.
 */
SendPool.drainLoop = async function () {
	if (SendPool.draining) {
		return;
	}
	SendPool.draining = true;

	const MAX_PER_BATCH = 50;

	while (SendPool.draining) {
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
				SendPool.draining = false;
				setTimeout(() => {
					if (SendPool.pool.length > 0) {
						SendPool.drainLoop();
					}
				}, 10000); // 10-second idle timeout
				return;
			}

			// Batch fetch task data to avoid await inside loop
			const taskDataList = await Promise.all(
				dueTasks.map(queueId => db.getObject(`ap:retry:queue:${queueId}`)),
			);
			const validTaskData = dueTasks
				.filter(queueId => !SendPool.inFlight.has(queueId))
				.map((queueId, i) => (taskDataList[i] ? { queueId, taskData: taskDataList[i] } : null))
				.filter(Boolean);

			// Fetch all key data in parallel
			const keyPromises = validTaskData.map(({ taskData }) => (
				SendPool._activityPub.getPrivateKey(taskData.type, taskData.id)
			));
			const keyResults = await Promise.all(keyPromises);

			// Dispatch each task
			for (let i = 0; i < validTaskData.length; i++) {
				const { queueId, taskData } = validTaskData[i];
				const keyData = keyResults[i];

				const taskId = createHash('sha256').update(`dispatch:${queueId}`).digest('hex');
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

				SendPool.pending.set(taskId, task);
				SendPool.inFlight.add(task.queueId);

				// Try to dispatch — if no free worker, leave in pending
				const dispatched = SendPool.dispatch(taskId, task);
				if (!dispatched) {
				// No workers available — task stays in pending for next iteration
					SendPool.pending.delete(taskId);
					SendPool.inFlight.delete(task.queueId);
					break;
				}
			}

			// Yield to event loop between batches to prevent starvation
			if (dueTasks.length >= MAX_PER_BATCH) {
				setImmediate(() => {
					if (SendPool.pool.length > 0) {
						SendPool.drainLoop();
					}
				});
			}
		} catch (e) {
			winston.error(`[activitypub/send] drainLoop error: ${e.message}`);
			SendPool.draining = false;
			// Schedule retry after a delay
			setTimeout(() => {
				if (SendPool.pool.length > 0) {
					SendPool.drainLoop();
				}
			}, 10000);
		}
	}
};

/**
 * Graceful shutdown — stop drain loop, shutdown workers, wait, then kill.
 */
SendPool.shutdown = function () {
	SendPool.isShuttingDown = true;
	SendPool.draining = false;

	// Send shutdown to all workers
	for (const worker of SendPool.pool) {
		try {
			worker.send({ type: 'shutdown' });
		} catch (e) { /* worker may already be disconnected */ }
	}

	// Wait for workers to exit (10s timeout)
	const shutdownTimeout = setTimeout(() => {
		for (const worker of SendPool.pool) {
			try {
				worker.kill('SIGTERM');
			} catch (e) { /* already dead */ }
		}
		// Second kill after 2s
		setTimeout(() => {
			for (const worker of SendPool.pool) {
				try {
					worker.kill('SIGKILL');
				} catch (e) { /* already dead */ }
			}
		}, 2000);
	}, 10000);

	shutdownTimeout.unref();
};

module.exports = SendPool;
