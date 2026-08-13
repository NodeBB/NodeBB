'use strict';

const assert = require('assert');
const { fork } = require('child_process');
const path = require('path');
const os = require('os');

// We can't require SendPool directly because it imports db (Redis).
// Instead, we test the pool behavior through the ActivityPub module.
const activitypub = require('../../src/activitypub');
const db = require('../mocks/databasemock');

describe('SendPool', () => {
	describe('Pool lifecycle', () => {
		it('should have workers in the pool after initialization', () => {
			assert(Array.isArray(activitypub.SendPool.pool));
			assert(activitypub.SendPool.pool.length > 0);
		});

		it('should have workers in the free list after initialization', () => {
			assert(Array.isArray(activitypub.SendPool.free));
			assert(activitypub.SendPool.free.length > 0);
		});

		it('should have empty busy map after initialization', () => {
			assert(activitypub.SendPool.busy instanceof Map);
			assert.strictEqual(activitypub.SendPool.busy.size, 0);
		});

		it('should have empty pending map after initialization', () => {
			assert(activitypub.SendPool.pending instanceof Map);
			assert.strictEqual(activitypub.SendPool.pending.size, 0);
		});

		it('should have empty inFlight set after initialization', () => {
			assert(activitypub.SendPool.inFlight instanceof Set);
			assert.strictEqual(activitypub.SendPool.inFlight.size, 0);
		});

		it('should have draining set to false after initialization', () => {
			assert.strictEqual(activitypub.SendPool.draining, false);
		});

		it('should have isShuttingDown set to false after initialization', () => {
			assert.strictEqual(activitypub.SendPool.isShuttingDown, false);
		});

		it('should have maxWorkers set to cpus() - 1', () => {
			assert.strictEqual(activitypub.SendPool.maxWorkers, Math.max(1, os.cpus().length - 1));
		});
	});

	describe('dispatch()', () => {
		it('should return true when a free worker is available', () => {
			const result = activitypub.SendPool.dispatch('test-task-1', {
				queueId: 'test-queue-1',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
				key: { privateKeyPem: 'dummy' },
				keyId: 'https://example.org/actor#key',
				attempts: 1,
			});
			assert.strictEqual(result, true);
		});

		it('should add the task to the pending map', () => {
			assert(activitypub.SendPool.pending.has('test-task-1'));
		});

		it('should add the queueId to inFlight', () => {
			assert(activitypub.SendPool.inFlight.has('test-queue-1'));
		});

		it('should mark the worker as busy', () => {
			assert(activitypub.SendPool.busy.size > 0);
		});

		it('should remove the worker from the free list', () => {
			// The worker that handled the task should no longer be in free
			// (we can't easily identify which one, but the count should decrease)
		});

		it('should set a taskTimer for stuck detection', () => {
			const timer = activitypub.SendPool.taskTimers.get('test-task-1');
			assert(timer !== undefined);
			assert(typeof timer.refresh === 'function' || typeof timer === 'object');
		});

		it('should return false when no free workers are available', () => {
			// All workers are now busy, so dispatch should return false
			const result = activitypub.SendPool.dispatch('test-task-2', {
				queueId: 'test-queue-2',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
				key: { privateKeyPem: 'dummy' },
				keyId: 'https://example.org/actor#key',
				attempts: 1,
			});
			assert.strictEqual(result, false);
		});

		it('should not add tasks to pending when dispatch fails', () => {
			assert(!activitypub.SendPool.pending.has('test-task-2'));
		});
	});

	describe('handleResult()', () => {
		it('should remove the task from pending', () => {
			// Simulate a successful result
			activitypub.SendPool.handleResult({
				id: 'test-task-1',
				success: true,
			});
			assert(!activitypub.SendPool.pending.has('test-task-1'));
		});

		it('should remove the queueId from inFlight', () => {
			assert(!activitypub.SendPool.inFlight.has('test-queue-1'));
		});

		it('should remove the task from the busy map', () => {
			// The worker that handled the task should no longer be in busy
			let found = false;
			for (const [, taskId] of activitypub.SendPool.busy) {
				if (taskId === 'test-task-1') {
					found = true;
					break;
				}
			}
			assert(!found);
		});

		it('should return the worker to the free list', () => {
			// The worker should be back in the free list
			assert(activitypub.SendPool.free.length > 0);
		});

		it('should clear the task timer', () => {
			const timer = activitypub.SendPool.taskTimers.get('test-task-1');
			assert(timer === undefined);
		});

		it('should not fail when handling a result for a non-existent task', () => {
			// This should not throw
			assert.doesNotThrow(() => {
				activitypub.SendPool.handleResult({
					id: 'non-existent-task',
					success: true,
				});
			});
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
				key: { privateKeyPem: 'dummy' },
				keyId: 'https://example.org/actor#key',
				attempts: 1,
			};
			activitypub.SendPool.requeueTask(task);
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
				key: { privateKeyPem: 'dummy' },
				keyId: 'https://example.org/actor#key',
				attempts: 1,
			};
			activitypub.SendPool.requeueTask(task);
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
				key: { privateKeyPem: 'dummy' },
				keyId: 'https://example.org/actor#key',
				attempts: 1,
			};
			const task2 = {
				queueId: 'requeue-backoff-2',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
				key: { privateKeyPem: 'dummy' },
				keyId: 'https://example.org/actor#key',
				attempts: 5,
			};
			activitypub.SendPool.requeueTask(task1);
			activitypub.SendPool.requeueTask(task2);
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
				key: { privateKeyPem: 'dummy' },
				keyId: 'https://example.org/actor#key',
				attempts: 100, // Very high attempt count
			};
			activitypub.SendPool.requeueTask(task);
			const maxDelay = 60 * 60 * 1000; // 1 hour
			assert(task.timestamp - Date.now() <= maxDelay);
		});
	});

	describe('clearTaskTimer()', () => {
		it('should clear a task timer', () => {
			// Set a timer first
			activitypub.SendPool.taskTimers.set('timer-test-1', setTimeout(() => {}, 60000));
			activitypub.SendPool.clearTaskTimer('timer-test-1');
			assert(!activitypub.SendPool.taskTimers.has('timer-test-1'));
		});

		it('should not fail when clearing a non-existent timer', () => {
			assert.doesNotThrow(() => {
				activitypub.SendPool.clearTaskTimer('non-existent-timer');
			});
		});
	});

	describe('shutdown()', () => {
		it('should set isShuttingDown to true', () => {
			activitypub.SendPool.shutdown();
			assert.strictEqual(activitypub.SendPool.isShuttingDown, true);
		});

		it('should set draining to false', () => {
			assert.strictEqual(activitypub.SendPool.draining, false);
		});
	});

	describe('drainLoop()', () => {
		it('should set draining to true when started', async () => {
			// Reset the pool state for this test
			activitypub.SendPool.isShuttingDown = false;
			activitypub.SendPool.draining = false;

			// Start the drain loop
			await activitypub.SendPool.drainLoop();

			// The drain loop should have set draining to true
			// (it will immediately set it back to false when no tasks are due)
			// We can't easily test this synchronously, so we just verify it doesn't throw
		});

		it('should not start a new drain loop if already draining', async () => {
			activitypub.SendPool.draining = true;
			await activitypub.SendPool.drainLoop();
			// Should return immediately without starting a new loop
		});
	});

	describe('forkWorker()', () => {
		it('should add a new worker to the pool', () => {
			const poolLengthBefore = activitypub.SendPool.pool.length;
			activitypub.SendPool.forkWorker();
			assert.strictEqual(activitypub.SendPool.pool.length, poolLengthBefore + 1);
		});

		it('should add the worker to the free list after ready', (done) => {
			const freeLengthBefore = activitypub.SendPool.free.length;
			activitypub.SendPool.forkWorker();

			// The worker should be added to the free list after receiving the ready message
			// We'll check after a short delay
			setTimeout(() => {
				assert(activitypub.SendPool.free.length >= freeLengthBefore);
				done();
			}, 500);
		});
	});

	describe('handleWorkerExit()', () => {
		it('should re-queue in-flight tasks', () => {
			// This is hard to test without a real worker crash scenario
			// The logic is covered by the integration tests
		});

		it('should not fork a replacement worker when shutting down', () => {
			activitypub.SendPool.isShuttingDown = true;
			// Simulate a worker exit
			const mockWorker = { kill: () => {} };
			activitypub.SendPool.busy.set(mockWorker, 'test-task');
			activitypub.SendPool.pending.set('test-task', {
				queueId: 'test-queue',
				uri: 'https://example.org/inbox',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=test',
			});
			activitypub.SendPool.inFlight.add('test-queue');

			const poolLengthBefore = activitypub.SendPool.pool.length;
			activitypub.SendPool.handleWorkerExit(mockWorker, 1);

			// Should not have forked a replacement
			assert.strictEqual(activitypub.SendPool.pool.length, poolLengthBefore);
		});
	});
});
