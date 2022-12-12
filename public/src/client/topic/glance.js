/* eslint-disable import/no-unresolved */

import { render } from 'benchpress';
import { loadMore } from 'forum/infinitescroll';
import * as navigator from 'navigator';
import { onPage, one as once } from 'hooks';
import { translate } from 'translator';

let trackTop;
let trackBottom;
let trackHeight;
let handleEl;

export default function init() {
	const topicEl = document.querySelector('[component="topic"]');
	const navigatorEl = document.querySelector('[component="topic/navigator"]');

	if (!ajaxify.data.template.topic || !topicEl || !navigatorEl) {
		return;
	}

	navigatorEl.classList.toggle('d-sm-flex', true);
	enableButtons();
	({ handleEl } = enableHandle());
	updateHandleText();
	updateUnreadIndicator();

	once('action:ajaxify.cleanup', () => {
		navigatorEl.classList.toggle('d-sm-flex', false);
		window.removeEventListener('resize', updateTrackPosition);
	});

	console.debug('[glance] At-a-glance navigator enabled.');
}

function updateTrackPosition() {
	const trackEl = document.querySelector('[component="topic/navigator"] .track');
	({ top: trackTop, bottom: trackBottom, height: trackHeight } = trackEl.getBoundingClientRect());
}

function enableButtons() {
	const navigatorEl = document.querySelector('[component="topic/navigator"]');
	navigatorEl.addEventListener('click', (e) => {
		const subselector = e.target.closest('[data-action]');
		if (!subselector) {
			return;
		}

		const action = subselector.getAttribute('data-action');
		navigator[action]();
	});
}

function enableHandle() {
	const handleEl = document.querySelector('[component="topic/navigator"] .handle');
	let active = false;

	updateTrackPosition();
	window.addEventListener('resize', updateTrackPosition);

	onPage('action:navigator.update', ({ newIndex }) => {
		if (!active) {
			repositionHandle(newIndex);
		}
	});

	onPage('action:navigator.scrolled', ({ newIndex }) => {
		if (!active) {
			repositionHandle(newIndex);
		}
	});

	handleEl.addEventListener('mousedown', (e) => {
		// Only respond to left click
		if (e.buttons !== 1) {
			return;
		}

		const tUpdateHandleText = utils.debounce(updateHandleText, 250);

		toggle(true);
		active = true;
		document.addEventListener('mousemove', onHandleMove);
		document.addEventListener('mousemove', tUpdateHandleText);
		document.addEventListener('mouseup', () => {
			toggle(false);
			document.removeEventListener('mousemove', onHandleMove);
			document.removeEventListener('mousemove', tUpdateHandleText);
			active = false;
		}, {
			once: true,
		});
	});

	return { handleEl };
}

async function updateUnreadIndicator() {
	if (ajaxify.data.postcount <= ajaxify.data.bookmarkThreshold) {
		return;
	}

	const index = Math.max(navigator.getIndex(), ajaxify.data.bookmark);
	const unreadEl = document.querySelector('[component="topic/navigator"] .unread');
	const percentage = 1 - (index / ajaxify.data.postcount);
	unreadEl.style.height = `${trackHeight * percentage}px`;

	const anchorEl = unreadEl.querySelector('.meta a');
	const remaining = ajaxify.data.postcount - index;
	if (remaining > 0) {
		const text = await translate(`[[topic:navigator.unread, ${remaining}]]`);
		anchorEl.href = `${config.relative_path}/topic/${ajaxify.data.slug}/${Math.min(index + 1, ajaxify.data.postcount)}`;
		anchorEl.innerText = text;
	} else {
		anchorEl.href = ajaxify.data.url;
		anchorEl.innerText = '';
	}
}

function repositionHandle(index) {
	// Updates the position of the handle on the track based on viewport
	if (!index) {
		index = navigator.getIndex() - 1;
	} else {
		index -= 1;
	}

	updateHandleText();
	updateUnreadIndicator();

	if (index === 0) {
		handleEl.style.top = 0;
		return;
	}

	const percentage = index / ajaxify.data.postcount;
	handleEl.style.top = `${trackHeight * percentage}px`;
}

async function updateHandleText() {
	const index = navigator.getIndex();
	const { tid } = ajaxify.data;
	const indexEl = handleEl.querySelector('.meta .index');
	const timestampEl = handleEl.querySelector('.meta .timestamp');

	const text = await translate(`[[topic:navigator.index, ${index}, ${ajaxify.data.postcount}]]`);
	indexEl.innerText = text;

	const { timestampISO } = await socket.emit('posts.getPostSummaryByIndex', { tid, index: index - 1 });
	timestampEl.title = timestampISO;
	$(timestampEl).timeago();
}

function onHandleMove(e) {
	const top = Math.min(trackBottom, Math.max(trackTop, e.clientY)) - trackTop;
	const percentage = top / trackHeight;

	const documentHeight = document.documentElement.scrollHeight - window.innerHeight;

	handleEl.style.top = `${top}px`;
	window.scrollTo(0, documentHeight * percentage);
}

function toggle(state) {
	const topicEl = document.querySelector('[component="topic"]');

	if (state === undefined) {
		state = app.flags._glance !== true;
	}

	topicEl.classList[state ? 'add' : 'remove']('minimal');

	if (state) {
		app.flags._glance = true;
		generatePlaceholders();
		registerScrollEvent();
	} else {
		removePlaceholders();
		deregisterScrollEvent();

		navigator.scrollToIndex(navigator.getIndex() - 1, true, 0);
		delete app.flags._glance;
	}
}

let ticking = false;
let scrollTimeout;
function onScrollTick() {
	if (!ticking) {
		window.requestAnimationFrame(() => {
			if (scrollTimeout) {
				clearTimeout(scrollTimeout);
			}
			scrollTimeout = setTimeout(onScrollEnd, 500);
			ticking = false;
		});

		ticking = true;
	}
}

async function onScrollEnd() {
	const placeholders = Array.from(document.querySelectorAll('[component="post/placeholder"]')).filter((el) => {
		const { top, bottom } = el.getBoundingClientRect();
		return bottom > 0 && top < window.innerHeight;
	});

	if (!placeholders.length) {
		return;
	}

	const firstIndex = placeholders[0].getAttribute('data-index');

	const { data, done } = await new Promise((resolve) => {
		loadMore('topics.loadMore', {
			tid: ajaxify.data.tid,
			after: firstIndex, // + (direction > 0 ? 1 : 0),
			count: placeholders.length,
			direction: 1,
			topicPostSort: config.topicPostSort,
		}, function (data, done) {
			resolve({ data, done });
		});
	});

	let elements = await app.parseAndTranslate('topic', 'posts', data);
	elements = Array.from(elements); // frickin' jquery
	elements = elements.filter(el => el.nodeType === 1);

	elements.forEach((el) => {
		const index = el.getAttribute('data-index');
		const placeholderEl = document.querySelector(`[component="post/placeholder"][data-index="${index}"]`);
		if (!placeholderEl) {
			return;
		}

		placeholderEl.replaceWith(el);
	});

	done();
}

function registerScrollEvent() {
	document.addEventListener('scroll', onScrollTick);
}

function deregisterScrollEvent() {
	document.removeEventListener('scroll', onScrollTick);
}

async function generatePlaceholders() {
	const { postcount } = ajaxify.data;
	const posts = document.querySelectorAll('[component="post"]');
	if (!posts.length) {
		throw new Error('[[error:no-post]]');
	}

	const firstPost = posts[0];
	const lastPost = posts[posts.length - 1];
	const firstIndex = parseInt(firstPost.getAttribute('data-index'), 10);
	const lastIndex = parseInt(lastPost.getAttribute('data-index'), 10);

	const numAbove = firstIndex;
	const numBelow = postcount - lastIndex - 1;

	const placeholderEl = document.createElement('li');
	const html = await render('partials/topic/post-placeholder', {});
	placeholderEl.classList.add('pt-4'); // harmony-specific
	placeholderEl.setAttribute('component', 'post/placeholder');

	const postsEl = document.querySelector('[component="topic"]');
	for (let x = 0, index = firstIndex; x < numAbove; x++, index--) {
		const node = placeholderEl.cloneNode();
		node.setAttribute('data-index', index - 1);
		node.innerHTML = html;
		postsEl.prepend(node);
	}
	for (let x = 0, index = lastIndex; x < numBelow; x++, index++) {
		const node = placeholderEl.cloneNode();
		node.setAttribute('data-index', index + 1);
		node.innerHTML = html;
		postsEl.append(node);
	}
}

function removePlaceholders() {
	// todo: directionality
	document.querySelectorAll('[component="post/placeholder"]').forEach(el => el.remove());
}
