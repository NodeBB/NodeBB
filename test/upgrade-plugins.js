'use strict';

const assert = require('assert');

const prompt = require('prompt');

const { getUpgradeConfirmation } = require('../src/cli/upgrade-plugins');

describe('Upgrade plugins', () => {
	describe('getUpgradeConfirmation()', () => {
		const originalIsTTY = process.stdin.isTTY;
		const originalGet = prompt.get;

		afterEach(() => {
			process.stdin.isTTY = originalIsTTY;
			prompt.get = originalGet;
		});

		it('should confirm without prompting when unattended', async () => {
			prompt.get = async () => assert.fail('prompt should not be called when unattended');
			assert.strictEqual(await getUpgradeConfirmation(true), true);
		});

		it('should decline without prompting when stdin is not a TTY', async () => {
			process.stdin.isTTY = false;
			prompt.get = async () => assert.fail('prompt should not be called without a TTY');
			assert.strictEqual(await getUpgradeConfirmation(false), false);
		});

		it('should prompt and confirm on a yes answer when stdin is a TTY', async () => {
			process.stdin.isTTY = true;
			prompt.get = async () => ({ upgrade: 'y' });
			assert.strictEqual(await getUpgradeConfirmation(false), true);
		});

		it('should prompt and decline on answers other than yes', async () => {
			process.stdin.isTTY = true;
			prompt.get = async () => ({ upgrade: 'n' });
			assert.strictEqual(await getUpgradeConfirmation(false), false);
		});
	});
});
