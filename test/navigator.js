'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Client navigator', () => {
	let navigator;
	let animateOptions;
	let targetTop;

	before(() => {
		const genericEl = {
			find: () => genericEl,
			on: () => genericEl,
			off: () => genericEl,
			outerHeight: () => 0,
		};
		const windowEl = {
			height: () => 600,
			on: () => windowEl,
			off: () => windowEl,
		};
		const animatedEl = {
			animate: (properties, options) => {
				animateOptions = options;
			},
		};

		const window = {};
		const $ = (selector) => {
			if (selector === window) {
				return windowEl;
			}
			if (selector === 'html, body') {
				return animatedEl;
			}
			return genericEl;
		};
		const define = (name, dependencies, factory) => {
			navigator = factory(
				{},
				{ get: () => ({ outerHeight: () => 50 }) },
				{ fire: async () => {} },
				{},
				{}
			);
		};

		const navigatorPath = path.join(__dirname, '../public/src/modules/navigator.js');
		vm.runInNewContext(fs.readFileSync(navigatorPath, 'utf8'), {
			$,
			define,
			window,
		}, {
			filename: navigatorPath,
		});
	});

	it('retargets an active scroll tween when content above the target changes height', async () => {
		targetTop = 500;
		const targetEl = {
			length: 1,
			outerHeight: () => 100,
			offset: () => ({ top: targetTop }),
		};

		await navigator.scrollToElement(targetEl, false, 400);

		assert.strictEqual(animateOptions.duration, 400);
		const tween = { start: 0, end: 250, now: 125 };
		animateOptions.step(125, tween);
		assert.deepStrictEqual(tween, { start: 0, end: 250, now: 125 });

		targetTop = 800;
		animateOptions.step(125, tween);
		assert.deepStrictEqual(tween, {
			start: 300,
			end: 550,
			now: 425,
			nodebbScrollTop: 550,
		});

		targetTop = 700;
		tween.now = 487.5;
		animateOptions.step(487.5, tween);
		assert.deepStrictEqual(tween, {
			start: 200,
			end: 450,
			now: 387.5,
			nodebbScrollTop: 450,
		});
	});
});
