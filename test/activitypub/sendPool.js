'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');
const activitypub = require('../../src/activitypub');
const SendPool = activitypub.SendPool;

describe('SendPool', () => {
	let originalActivityPub;
	let originalPoolSize;

	beforeEach(() => {
		originalActivityPub = SendPool._activityPub;
		originalPoolSize = SendPool._pool?.size;
	});

	afterEach((done) => {
		// Restore original state
		SendPool._activityPub = originalActivityPub;
		SendPool._draining = false;

		// Shutdown pool
		SendPool.shutdown();

		// Wait for workers to exit
		setTimeout(done, 1000);
	});

	describe('Pool lifecycle', () => {
		it('should create a pool with worker count property', () => {
			assert(Number.isInteger(SendPool.pool));
		});

		it('should return the current worker count', () => {
			// Pool might not have workers initialized yet (lazy startup)
			// so we just verify it's a non-negative integer
			assert(SendPool.pool >= 0);
		});
	});

	describe('dispatch()', () => {
		it('should return a thenable when pool has workers', async () => {
			// Wait briefly for workerpool to initialize workers
			await new Promise(resolve => setTimeout(resolve, 500));

			const result = SendPool.dispatch({
				queueId: 'test-queue-1',
				uri: 'https://nonexistent.invalid/test',
				id: 'test-id',
				payloadType: 'Create',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=invalid',
			});
			assert(typeof result?.then === 'function');
			// Wait for the promise to settle
			const resolved = await result;
			assert.strictEqual(resolved.success, false);
		});
	});

	describe('handleResult()', () => {
		it('should not fail when handling a result for a non-existent queue', () => {
			assert.doesNotThrow(() => {
				SendPool.handleResult('non-existent-queue', {
					success: true,
				});
			});
		});

		it('should handle failure result without error', () => {
			assert.doesNotThrow(() => {
				SendPool.handleResult('fail-queue', {
					success: false,
					error: 'test error',
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

	describe('shutdown()', () => {
		it('should set draining to false', () => {
			SendPool._draining = true;
			SendPool.shutdown();
			assert.strictEqual(SendPool._draining, false);
		});
	});

	describe('drainLoop()', () => {
		it('should not start a new drain loop if already draining', async () => {
			SendPool._draining = true;
			await SendPool.drainLoop();
			// Should return immediately without starting a new loop
			assert.strictEqual(SendPool._draining, true);
		});
	});
});
