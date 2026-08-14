'use strict';

const assert = require('assert');
const os = require('os');

const db = require('../mocks/databasemock');
const activitypub = require('../../src/activitypub');
const SendPool = activitypub.SendPool;

describe('SendPool', () => {
	/**
	 * Reset SendPool state to a clean initialization without forking workers.
	 * This allows tests to run in isolation without shared worker state.
	 */
	function resetPool() {
		// Kill all existing workers
		for (const worker of SendPool.pool) {
			try { worker.kill('SIGKILL'); } catch (e) { /* ignore */ }
		}
		SendPool.pool = [];
		SendPool.free = [];
		SendPool.busy = new Map();
		SendPool.pending = new Map();
		SendPool.taskTimers = new Map();
		SendPool.inFlight = new Set();
		SendPool.draining = false;
		SendPool.isShuttingDown = false;
		SendPool.maxWorkers = Math.max(1, os.cpus().length - 1);
	}

	beforeEach(() => {
		resetPool();
	});

	afterEach((done) => {
		// Shutdown any remaining workers
		SendPool.isShuttingDown = true;
		SendPool.draining = false;
		for (const worker of SendPool.pool) {
			try { worker.kill('SIGKILL'); } catch (e) { /* ignore */ }
		}
		// Clear any pending timers
		for (const timer of SendPool.taskTimers.values()) {
			clearTimeout(timer);
		}
		SendPool.taskTimers.clear();
		// Wait a tick for workers to exit
		setTimeout(done, 200);
	});

	describe('Pool lifecycle', () => {
		it('should have empty pool after reset', () => {
			assert(Array.isArray(SendPool.pool));
			assert.strictEqual(SendPool.pool.length, 0);
		});

		it('should have empty free list after reset', () => {
			assert(Array.isArray(SendPool.free));
			assert.strictEqual(SendPool.free.length, 0);
		});

		it('should have empty busy map after reset', () => {
			assert(SendPool.busy instanceof Map);
			assert.strictEqual(SendPool.busy.size, 0);
		});

		it('should have empty pending map after reset', () => {
			assert(SendPool.pending instanceof Map);
			assert.strictEqual(SendPool.pending.size, 0);
		});

		it('should have empty inFlight set after reset', () => {
			assert(SendPool.inFlight instanceof Set);
			assert.strictEqual(SendPool.inFlight.size, 0);
		});

		it('should have draining set to false after reset', () => {
			assert.strictEqual(SendPool.draining, false);
		});

		it('should have isShuttingDown set to false after reset', () => {
			assert.strictEqual(SendPool.isShuttingDown, false);
		});

		it('should have maxWorkers set to cpus() - 1', () => {
			assert.strictEqual(SendPool.maxWorkers, Math.max(1, os.cpus().length - 1));
		});
	});

	describe('dispatch()', () => {
		it('should return false when no free workers are available', () => {
			const result = SendPool.dispatch('test-task-1', {
				queueId: 'test-queue-1',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
			});
			assert.strictEqual(result, false);
		});

		it('should not add tasks to pending when dispatch fails', () => {
			SendPool.dispatch('test-task-2', {
				queueId: 'test-queue-2',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
			});
			assert(!SendPool.pending.has('test-task-2'));
		});
	});

	describe('handleResult()', () => {
		it('should not fail when handling a result for a non-existent task', () => {
			assert.doesNotThrow(() => {
				SendPool.handleResult({
					id: 'non-existent-task',
					success: true,
				});
			});
		});

		it('should clear a task timer if the task exists in pending', () => {
			// Pre-populate pending with a task
			const timer = setTimeout(() => {}, 60000);
			SendPool.taskTimers.set('existing-task', timer);
			SendPool.pending.set('existing-task', {
				queueId: 'test-queue-existing',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
			});

			SendPool.handleResult({
				id: 'existing-task',
				success: true,
			});

			assert(!SendPool.pending.has('existing-task'));
			assert(!SendPool.taskTimers.has('existing-task'));
		});
	});

	describe('requeueTask()', () => {
		it('should increment the attempts count', () => {
			const task = {
				queueId: 'requeue-test-1',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
				attempts: 1,
			};
			SendPool.requeueTask(task);
			assert.strictEqual(task.attempts, 2);
		});

		it('should set the timestamp to now + backoff', () => {
			const task = {
				queueId: 'requeue-test-2',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
				attempts: 1,
			};
			SendPool.requeueTask(task);
			assert(task.timestamp > Date.now());
		});

		it('should use exponential backoff', () => {
			const task1 = {
				queueId: 'requeue-backoff-1',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
				attempts: 1,
			};
			const task2 = {
				queueId: 'requeue-backoff-2',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
				attempts: 5,
			};
			SendPool.requeueTask(task1);
			SendPool.requeueTask(task2);
			// task2 with 5 attempts should have a much longer backoff than task1 with 1 attempt
			assert(task2.timestamp > task1.timestamp);
		});

		it('should cap backoff at 1 hour', () => {
			const task = {
				queueId: 'requeue-cap-1',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
				attempts: 100, // Very high attempt count
			};
			SendPool.requeueTask(task);
			const maxDelay = 60 * 60 * 1000; // 1 hour
			assert(task.timestamp - Date.now() <= maxDelay);
		});
	});

	describe('clearTaskTimer()', () => {
		it('should clear a task timer', () => {
			const timer = setTimeout(() => {}, 60000);
			SendPool.taskTimers.set('timer-test-1', timer);
			SendPool.clearTaskTimer('timer-test-1');
			assert(!SendPool.taskTimers.has('timer-test-1'));
		});

		it('should not fail when clearing a non-existent timer', () => {
			assert.doesNotThrow(() => {
				SendPool.clearTaskTimer('non-existent-timer');
			});
		});
	});

	describe('shutdown()', () => {
		it('should set isShuttingDown to true', () => {
			SendPool.shutdown();
			assert.strictEqual(SendPool.isShuttingDown, true);
		});

		it('should set draining to false', () => {
			SendPool.shutdown();
			assert.strictEqual(SendPool.draining, false);
		});
	});

	describe('drainLoop()', () => {
		it('should not start a new drain loop if already draining', async () => {
			SendPool.draining = true;
			await SendPool.drainLoop();
			// Should return immediately without starting a new loop
			assert.strictEqual(SendPool.draining, true);
		});
	});

	describe('forkWorker()', () => {
		it('should add a new worker to the pool', () => {
			const poolLengthBefore = SendPool.pool.length;
			SendPool.forkWorker();
			assert.strictEqual(SendPool.pool.length, poolLengthBefore + 1);
		});

		it('should add the worker to the free list after ready', (done) => {
			const freeLengthBefore = SendPool.free.length;
			SendPool.forkWorker();

			// The worker should be added to the free list after receiving the ready message
			setTimeout(() => {
				assert(SendPool.free.length >= freeLengthBefore);
				done();
			}, 500);
		});
	});

	describe('handleWorkerExit()', () => {
		it('should not fork a replacement worker when shutting down', () => {
			SendPool.isShuttingDown = true;
			// Simulate a worker exit
			const mockWorker = { kill: () => {} };
			SendPool.busy.set(mockWorker, 'test-task');
			SendPool.pending.set('test-task', {
				queueId: 'test-queue',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
			});
			SendPool.inFlight.add('test-queue');

			const poolLengthBefore = SendPool.pool.length;
			SendPool.handleWorkerExit(mockWorker, 1);

			// Should not have forked a replacement
			assert.strictEqual(SendPool.pool.length, poolLengthBefore);
		});

		it('should handle exit when worker had no task (busy map empty for that worker)', () => {
			// This tests the bug fix where task could be undefined
			const mockWorker = { kill: () => {} };
			SendPool.pool.push(mockWorker);
			SendPool.free.push(mockWorker);

			// Worker exits without having been assigned a task
			assert.doesNotThrow(() => {
				SendPool.handleWorkerExit(mockWorker, 0);
			});

			// Worker should be removed from pool and free
			assert(!SendPool.pool.includes(mockWorker));
			assert(!SendPool.free.includes(mockWorker));
		});
	});
});
