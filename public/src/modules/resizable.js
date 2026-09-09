'use strict';

/**
 * Vanilla JS resizable module with jQuery UI-like handle behavior.
 *
 * Supports:
 * - LTR and RTL layouts
 * - Mouse and touch dragging
 * - Selector strings and jQuery-wrapped elements in init/destroy
 * - jQuery-style resize payload shape: detail.originalSize / detail.size
 */


const HANDLE_SIZE = 8;

const defaultOptions = {
	minWidth: 50,
	minHeight: 50,
	maxWidth: Infinity,
	maxHeight: Infinity,
	handles: 'se',
};

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function resolveElement(el) {
	if (!el) {
		return null;
	}

	if (typeof el === 'string') {
		return document.querySelector(el);
	}

	if (el instanceof Element) {
		return el;
	}

	if (typeof el === 'object' && el !== null && el[0] instanceof Element) {
		return el[0];
	}

	return null;
}

function createHandle(el, position) {
	const handle = document.createElement('div');
	handle.className = `nbb-ui-resizable-handle nbb-ui-resizable-${position}`;
	handle.setAttribute('data-resizable-handle', position);

	Object.assign(handle.style, {
		position: 'absolute',
		zIndex: '90',
		userSelect: 'none',
	});

	const s = `${HANDLE_SIZE}px`;
	const half = `${HANDLE_SIZE / 2}px`;

	switch (position) {
		case 'n':
			Object.assign(handle.style, { top: `-${half}`, left: '0', right: '0', height: s, cursor: 'n-resize' });
			break;
		case 's':
			Object.assign(handle.style, { bottom: `-${half}`, left: '0', right: '0', height: s, cursor: 's-resize' });
			break;
		case 'e':
			Object.assign(handle.style, { top: '0', bottom: '0', right: `-${half}`, width: s, cursor: 'e-resize' });
			break;
		case 'w':
			Object.assign(handle.style, { top: '0', bottom: '0', left: `-${half}`, width: s, cursor: 'w-resize' });
			break;
		case 'ne':
			Object.assign(handle.style, { top: `-${half}`, right: `-${half}`, width: s, height: s, cursor: 'ne-resize' });
			break;
		case 'nw':
			Object.assign(handle.style, { top: `-${half}`, left: `-${half}`, width: s, height: s, cursor: 'nw-resize' });
			break;
		case 'se':
			Object.assign(handle.style, { bottom: `-${half}`, right: `-${half}`, width: s, height: s, cursor: 'se-resize' });
			break;
		case 'sw':
			Object.assign(handle.style, { bottom: `-${half}`, left: `-${half}`, width: s, height: s, cursor: 'sw-resize' });
			break;
		default:
			return null;
	}

	el.appendChild(handle);
	return handle;
}

function attachDrag(el, handle, position, opts) {
	let startX = 0;
	let startY = 0;
	let startW = 0;
	let startH = 0;
	let startStyleLeft = 0;
	let startStyleRight = 0;
	let startStyleTop = 0;

	function onStart(e) {
		e.preventDefault();
		const point = e.touches ? e.touches[0] : e;
		startX = point.clientX;
		startY = point.clientY;

		// const rect = el.getBoundingClientRect();
		startW = el.offsetWidth;
		startH = el.offsetHeight;

		// Read and write style offsets in the same coordinate space.
		const styles = window.getComputedStyle(el);
		startStyleLeft = parseFloat(styles.left) || 0;
		startStyleRight = parseFloat(styles.right) || 0;
		startStyleTop = parseFloat(styles.top) || 0;

		document.addEventListener('mousemove', onMove);
		document.addEventListener('touchmove', onMove, { passive: false });
		document.addEventListener('mouseup', onEnd);
		document.addEventListener('touchend', onEnd);

		el.dispatchEvent(new CustomEvent('resizestart', { bubbles: true }));
	}

	function onMove(e) {
		e.preventDefault();
		const point = e.touches ? e.touches[0] : e;
		const dx = point.clientX - startX;
		const dy = point.clientY - startY;

		let newW = startW;
		let newH = startH;
		let newLeft = startStyleLeft;
		let newRight = startStyleRight;
		let newTop = startStyleTop;

		const affects = {
			n: position === 'n' || position === 'ne' || position === 'nw',
			s: position === 's' || position === 'se' || position === 'sw',
			e: position === 'e' || position === 'ne' || position === 'se',
			w: position === 'w' || position === 'nw' || position === 'sw',
		};

		// 1. Calculate intended dimensions
		if (affects.s) newH = clamp(startH + dy, opts.minHeight, opts.maxHeight);
		if (affects.n) newH = clamp(startH - dy, opts.minHeight, opts.maxHeight);
		if (affects.e) newW = clamp(startW + dx, opts.minWidth, opts.maxWidth);
		if (affects.w) newW = clamp(startW - dx, opts.minWidth, opts.maxWidth);

		// 2. Apply dimensions FIRST so the browser can enforce constraints
		el.style.width = `${newW}px`;
		el.style.height = `${newH}px`;

		// 3. Read back the ACTUAL dimensions rendered by the browser
		const actualW = el.offsetWidth;
		const actualH = el.offsetHeight;

		// 4. Calculate positions based on ACTUAL browser sizes
		if (affects.n) {
			newTop = startStyleTop + (startH - actualH);
		}

		const isRtl = getComputedStyle(el).direction === 'rtl';

		if (isRtl) {
			if (affects.e) {
				newRight = startStyleRight + (startW - actualW);
			}
			// If affects.w is true, newRight safely remains startStyleRight
			el.style.right = `${newRight}px`;
			el.style.left = ''; // Clear left to prevent layout conflicts in RTL
			el.style.top = `${newTop}px`;
			el.style.bottom = ''; // Clear bottom to prevent layout conflicts
		} else {
			if (affects.w) {
				newLeft = startStyleLeft + (startW - actualW);
			}
			// If affects.e is true, newLeft safely remains startStyleLeft
			el.style.left = `${newLeft}px`;
			el.style.right = ''; // Clear right to prevent layout conflicts in LTR
			el.style.top = `${newTop}px`;
			el.style.bottom = ''; // Clear bottom to prevent layout conflicts
		}

		// 5. Dispatch event with the actual rendered sizes
		el.dispatchEvent(new CustomEvent('resize', {
			bubbles: true,
			detail: {
				originalSize: { width: startW, height: startH },
				size: { width: actualW, height: actualH },
			},
		}));
	}

	function onEnd() {
		document.removeEventListener('mousemove', onMove);
		document.removeEventListener('touchmove', onMove, { passive: false });
		document.removeEventListener('mouseup', onEnd);
		document.removeEventListener('touchend', onEnd);

		el.dispatchEvent(new CustomEvent('resizestop', { bubbles: true }));
	}

	handle.addEventListener('mousedown', onStart);
	handle.addEventListener('touchstart', onStart, { passive: false });
}

export function init(el, options) {
	const target = resolveElement(el);
	if (!target) {
		return;
	}

	const opts = Object.assign({}, defaultOptions, options || {});

	const pos = getComputedStyle(target).position;
	if (pos === 'static') {
		target.style.position = 'relative';
	}

	if (target.dataset.resizable === 'true') {
		return;
	}

	target.dataset.resizable = 'true';
	target.classList.add('ui-resizable');

	const handleKeys = opts.handles
		.split(',')
		.map((h) => h.trim().toLowerCase())
		.filter(Boolean);

	for (const position of handleKeys) {
		const handle = createHandle(target, position);
		if (!handle) {
			continue;
		}
		attachDrag(target, handle, position, opts);
	}
}

export function destroy(el) {
	const target = resolveElement(el);
	if (!target || target.dataset.resizable !== 'true') {
		return;
	}

	target.querySelectorAll('[data-resizable-handle]').forEach((h) => h.remove());
	target.classList.remove('ui-resizable');
	delete target.dataset.resizable;
}

