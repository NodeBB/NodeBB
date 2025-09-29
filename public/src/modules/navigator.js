'use strict';

define('navigator', [
	'forum/pagination', 'components', 'hooks', 'alerts', 'translator', 'storage',
], function (pagination, components, hooks, alerts, translator, storage) {
	const navigator = {};
	let index = 0;
	let count = 0;
	let remaining = 0;
	let navigatorUpdateTimeoutId;

	let renderPostIntervalId;
	let touchX;
	let touchY;
	let renderPostIndex;
	let isNavigating = false;
	let firstMove = true;
	let bsEnv = '';
	navigator.scrollActive = false;

	let paginationBlockEl = $('.pagination-block');
	let paginationTextEl = paginationBlockEl.find('.pagination-text');
	let paginationBlockMeterEl = paginationBlockEl.find('meter');
	let paginationBlockProgressEl = paginationBlockEl.find('.progress-bar');
	let paginationBlockUnreadEl = paginationBlockEl.find('.unread');
	let thumbs;

	$(window).on('action:ajaxify.start', function () {
		$(window).off('keydown', onKeyDown);
	});

	navigator.init = function (selector, count, toTop, toBottom, callback) {
		index = 0;
		navigator.selector = selector;
		navigator.callback = callback;
		navigator.toTop = toTop || function () {};
		navigator.toBottom = toBottom || function () {};

		paginationBlockEl = $('.pagination-block');
		paginationTextEl = paginationBlockEl.find('.pagination-text');
		paginationBlockMeterEl = paginationBlockEl.find('meter');
		paginationBlockProgressEl = paginationBlockEl.find('.progress-bar');
		paginationBlockUnreadEl = paginationBlockEl.find('.unread');

		thumbs = $('.scroller-thumb');
		bsEnv = utils.findBootstrapEnvironment();

		$(window).off('scroll', navigator.delayedUpdate).on('scroll', navigator.delayedUpdate);

		paginationBlockEl.find('.dropdown-menu').off('click').on('click', function (e) {
			e.stopPropagation();
		});

		paginationBlockEl.off('shown.bs.dropdown', '.wrapper').on('shown.bs.dropdown', '.wrapper', function () {
			const el = $(this);
			setTimeout(async function () {
				if (['lg', 'xl', 'xxl'].includes(utils.findBootstrapEnvironment())) {
					el.find('input').trigger('focus');
				}
				const postCountInTopic = await socket.emit('topics.getPostCountInTopic', ajaxify.data.tid);
				if (postCountInTopic > 0) {
					paginationBlockEl.find('#myNextPostBtn').removeAttr('disabled');
				}
			}, 100);
		});
		paginationBlockEl.find('.pageup').off('click').on('click', navigator.scrollUp);
		paginationBlockEl.find('.pagedown').off('click').on('click', navigator.scrollDown);
		paginationBlockEl.find('.pagetop').off('click').on('click', navigator.toTop);
		paginationBlockEl.find('.pagebottom').off('click').on('click', navigator.toBottom);
		paginationBlockEl.find('.pageprev').off('click').on('click', pagination.previousPage);
		paginationBlockEl.find('.pagenext').off('click').on('click', pagination.nextPage);
		paginationBlockEl.find('#myNextPostBtn').off('click').on('click', gotoMyNextPost);

		paginationBlockEl.find('input').on('keydown', function (e) {
			if (e.which === 13) {
				const input = $(this);
				if (!utils.isNumber(input.val())) {
					input.val('');
					return;
				}

				const index = parseInt(input.val(), 10);
				const url = generateUrl(index);
				input.val('');
				paginationBlockEl.find('.dopdown-menu.show').removeClass('show');
				ajaxify.go(url);
			}
		});

		if (ajaxify.data.template.topic) {
			handleScrollNav();
			remaining = ajaxify.data.postcount;
			updateUnreadIndicator(ajaxify.data.postIndex);
		}

		handleKeys();

		navigator.setCount(count);
		navigator.update();
	};

	let lastNextIndex = 0;
	async function gotoMyNextPost() {
		async function getNext(startIndex) {
			return await socket.emit('topics.getMyNextPostIndex', {
				tid: ajaxify.data.tid,
				index: Math.max(1, startIndex),
				sort: config.topicPostSort,
			});
		}
		if (ajaxify.data.template.topic) {
			let nextIndex = await getNext(index);
			if (lastNextIndex === nextIndex) { // handles last post in pagination
				nextIndex = await getNext(nextIndex);
			}
			if (nextIndex && index !== nextIndex + 1) {
				lastNextIndex = nextIndex;
				$(window).one('action:ajaxify.end', function () {
					if (paginationBlockEl.find('.dropdown-menu').is(':hidden')) {
						paginationBlockEl.find('.dropdown-toggle').dropdown('toggle');
					}
				});
				navigator.scrollToIndex(nextIndex, true, 0);
			} else {
				alerts.alert({
					message: '[[topic:no-more-next-post]]',
					type: 'info',
				});

				lastNextIndex = 1;
			}
		}
	}

	function clampTop(thumb, newTop) {
		const parent = thumb.parent();
		const parentOffset = parent.offset();
		const thumbIcon = thumb.find('.scroller-thumb-icon');
		const thumbIconHeight = thumbIcon.height();
		if (newTop < parentOffset.top) {
			newTop = parentOffset.top;
		} else if (newTop > parentOffset.top + parent.height() - thumbIconHeight) {
			newTop = parentOffset.top + parent.height() - thumbIconHeight;
		}
		return newTop;
	}

	function setThumbToIndex(index) {
		if (!thumbs || !thumbs.length || !thumbs.is(':visible')) {
			return;
		}

		thumbs.each((i, el) => {
			const thumb = $(el);
			if (thumb.is(':hidden')) {
				return;
			}

			const parent = thumb.parent();
			const parentOffset = parent.offset();
			const thumbIcon = thumb.find('.scroller-thumb-icon');
			const thumbIconHeight = thumbIcon.height();
			const gap = (parent.height() - thumbIconHeight) / (ajaxify.data.postcount - 1);
			const newTop = clampTop(thumb, parentOffset.top + ((index - 1) * gap));
			const offset = { top: newTop, left: thumb.offset().left };
			thumb.offset(offset);
			updateThumbTextToIndex(thumb, index);
			updateThumbTimestampToIndex(thumb, index);
		});

		updateUnreadIndicator(index);
		renderPost(index);
	}

	function updateThumbTextToIndex(thumb, index) {
		if (bsEnv === 'xs' || bsEnv === 'sm' || bsEnv === 'md') {
			thumb.find('.thumb-text').text(`${index}/${ajaxify.data.postcount}`);
		} else {
			thumb.find('.thumb-text').translateText(`[[topic:navigator.index, ${index}, ${ajaxify.data.postcount}]]`);
		}
	}

	async function updateThumbTimestampToIndex(thumb, index) {
		const el = thumb.find('.thumb-timestamp');
		if (el.length) {
			const postAtIndex = ajaxify.data.posts.find(
				p => parseInt(p.index, 10) === Math.max(0, parseInt(index, 10) - 1)
			);
			const timestamp = postAtIndex ? postAtIndex.timestamp : await getPostTimestampByIndex(index);
			el.attr('title', utils.toISOString(timestamp)).timeago();
		}
	}

	async function getPostTimestampByIndex(index) {
		// load timestamp of post from DOM if it exists
		// if not load from server
		const postEl = $(`[component="post"][data-index=${index - 1}]`);
		if (postEl.length) {
			return parseInt(postEl.attr('data-timestamp'), 10);
		}
		return await socket.emit('posts.getPostTimestampByIndex', {
			tid: ajaxify.data.tid,
			index: index - 1,
		});
	}


	function handleScrollNav() {
		if (!thumbs.length) {
			return;
		}

		const parents = thumbs.parent();
		parents.off('click').on('click', function (ev) {
			if ($(ev.target).hasClass('scroller-container')) {
				const thumb = $(ev.target).find('.scroller-thumb');
				const index = calculateIndexFromY(thumb, ev.pageY);
				navigator.scrollToIndex(index - 1, true, 0);
				return false;
			}
		});

		function calculateIndexFromY(thumb, y) {
			const parent = thumb.parent();
			const thumbIcon = thumb.find('.scroller-thumb-icon');
			const thumbIconHeight = thumbIcon.height();
			const newTop = clampTop(thumb, y - (thumbIconHeight / 2));
			const parentOffset = parent.offset();
			const percent = (newTop - parentOffset.top) / (parent.height() - thumbIconHeight);
			index = Math.max(1, Math.ceil(ajaxify.data.postcount * percent));
			return index > ajaxify.data.postcount ? ajaxify.data.postcount : index;
		}

		let mouseDragging = false;
		hooks.on('action:ajaxify.end', function () {
			renderPostIndex = null;
		});
		paginationBlockEl.find('.dropdown-menu').parent()
			.off('shown.bs.dropdown')
			.on('shown.bs.dropdown', function () {
				setThumbToIndex(index);
			});

		// the thumb that's being dragged, there can be more than on on the DOM
		let dragThumb = null;
		const debounceUpdateThumbTimestamp = utils.debounce(updateThumbTimestampToIndex, 50);
		function mousemove(ev) {
			if (!dragThumb || !dragThumb.length) {
				return;
			}
			const thumbIcon = dragThumb.find('.scroller-thumb-icon');
			const thumbIconHeight = thumbIcon.height();
			const newTop = clampTop(dragThumb, ev.pageY - (thumbIconHeight / 2));
			dragThumb.offset({ top: newTop, left: dragThumb.offset().left });
			const index = calculateIndexFromY(dragThumb, ev.pageY);
			navigator.updateTextAndProgressBar();
			updateThumbTextToIndex(dragThumb, index);
			debounceUpdateThumbTimestamp(dragThumb, index);
			if (firstMove) {
				delayedRenderPost();
			}
			firstMove = false;
			ev.stopPropagation();
			return false;
		}

		thumbs.off('mousedown').on('mousedown', function (e) {
			if (e.originalEvent.button !== 0) {
				return;
			}

			mouseDragging = true;
			dragThumb = $(this);
			dragThumb.addClass('active');
			$(window).on('mousemove', mousemove);
			firstMove = true;
		});

		function mouseup() {
			$(window).off('mousemove', mousemove);
			if (mouseDragging) {
				navigator.scrollToIndex(index - 1, true, 0);
				paginationBlockEl.find('.dropdown-menu.show').removeClass('show');
			}
			clearRenderInterval();
			mouseDragging = false;
			firstMove = false;
			if (dragThumb && dragThumb.length) {
				dragThumb.removeClass('active');
			}
			dragThumb = null;
		}

		function delayedRenderPost() {
			clearRenderInterval();
			renderPostIntervalId = setInterval(function () {
				renderPost(index);
			}, 250);
		}

		$(window).off('mousemove', mousemove);
		$(window).off('mouseup', mouseup).on('mouseup', mouseup);

		thumbs.each((i, el) => {
			const thumb = $(el);

			thumb.off('touchstart').on('touchstart', function (ev) {
				isNavigating = true;
				touchX = Math.min($(window).width(), Math.max(0, ev.touches[0].clientX));
				touchY = Math.min($(window).height(), Math.max(0, ev.touches[0].clientY));
				firstMove = true;
				thumb.addClass('active');
			});

			thumb.off('touchmove').on('touchmove', function (ev) {
				const windowWidth = $(window).width();
				const windowHeight = $(window).height();
				const deltaX = Math.abs(touchX - Math.min(windowWidth, Math.max(0, ev.touches[0].clientX)));
				const deltaY = Math.abs(touchY - Math.min(windowHeight, Math.max(0, ev.touches[0].clientY)));
				touchX = Math.min(windowWidth, Math.max(0, ev.touches[0].clientX));
				touchY = Math.min(windowHeight, Math.max(0, ev.touches[0].clientY));

				if (deltaY >= deltaX && firstMove) {
					isNavigating = true;
					delayedRenderPost();
				}

				if (isNavigating && ev.cancelable) {
					ev.preventDefault();
					ev.stopPropagation();
					const thumbIcon = thumb.find('.scroller-thumb-icon');
					const thumbIconHeight = thumbIcon.height();
					const newTop = clampTop(thumb, touchY + $(window).scrollTop() - (thumbIconHeight / 2));
					thumb.offset({ top: newTop, left: thumb.offset().left });
					const index = calculateIndexFromY(thumb, touchY + $(window).scrollTop());
					navigator.updateTextAndProgressBar();
					updateThumbTextToIndex(thumb, index);
					debounceUpdateThumbTimestamp(thumb, index);
					if (firstMove) {
						renderPost(index);
					}
				}
				firstMove = false;
			});

			thumb.off('touchend').on('touchend', function () {
				clearRenderInterval();
				if (isNavigating) {
					thumb.removeClass('active');
					navigator.scrollToIndex(index - 1, true, 0);
					isNavigating = false;
					paginationBlockEl.find('.dropdown-menu.show').removeClass('show');
				}
			});
		});
	}

	async function updateUnreadIndicator(index) {
		const { bookmarkThreshold } = ajaxify.data;
		if (!paginationBlockUnreadEl.length || ajaxify.data.postcount <= bookmarkThreshold || !bookmarkThreshold) {
			return;
		}
		const currentBookmark = ajaxify.data.bookmark || storage.getItem('topic:' + ajaxify.data.tid + ':bookmark');
		index = Math.max(index, Math.min(currentBookmark, ajaxify.data.postcount));
		const unreadEl = paginationBlockUnreadEl.get(0);
		const trackEl = unreadEl.parentNode;
		const trackHeight = trackEl.getBoundingClientRect().height;

		const percentage = 1 - (index / ajaxify.data.postcount);
		unreadEl.style.height = `${trackHeight * percentage}px`;

		const thumbEl = trackEl.querySelector('.scroller-thumb');
		const thumbHeight = parseInt(thumbEl.style.height, 10);
		const thumbBottom = parseInt(thumbEl.style.top || 0, 10) + thumbHeight;
		const anchorEl = unreadEl.querySelector('.meta a');
		remaining = Math.min(remaining, ajaxify.data.postcount - index);

		function toggleAnchor(text) {
			anchorEl.innerText = text;
			anchorEl.setAttribute('aria-disabled', text ? 'false' : 'true');
			if (text) {
				anchorEl.removeAttribute('tabindex');
			} else {
				anchorEl.setAttribute('tabindex', -1);
			}
		}

		if (remaining > 0 && (trackHeight - thumbBottom) >= thumbHeight) {
			const text = await translator.translate(`[[topic:navigator.unread, ${remaining}]]`);
			anchorEl.href = `${config.relative_path}/topic/${ajaxify.data.slug}/${Math.min(index + 1, ajaxify.data.postcount)}`;
			toggleAnchor(text);
		} else {
			anchorEl.href = ajaxify.data.url;
			toggleAnchor('');
		}
	}

	function clearRenderInterval() {
		if (renderPostIntervalId) {
			clearInterval(renderPostIntervalId);
			renderPostIntervalId = 0;
		}
	}

	async function renderPost(index) {
		if (!index || renderPostIndex === index || !paginationBlockEl.find('.post-content').is(':visible')) {
			return;
		}
		renderPostIndex = index;

		const postData = await socket.emit('posts.getPostSummaryByIndex', { tid: ajaxify.data.tid, index: index - 1 });

		const html = await app.parseAndTranslate('partials/topic/navigation-post', { post: postData });
		paginationBlockEl
			.find('.post-content')
			.html(html)
			.find('.timeago').timeago();
	}

	function handleKeys() {
		if (!config.usePagination) {
			$(window).off('keydown', onKeyDown).on('keydown', onKeyDown);
		}
	}

	function onKeyDown(ev) {
		if (ev.target.nodeName === 'BODY') {
			if (ev.shiftKey || ev.ctrlKey || ev.altKey) {
				return;
			}
			if (ev.which === 36 && navigator.toTop) { // home key
				navigator.toTop();
				return false;
			} else if (ev.which === 35 && navigator.toBottom) { // end key
				navigator.toBottom();
				return false;
			}
		}
	}

	function generateUrl(index) {
		const pathname = window.location.pathname.replace(config.relative_path, '');
		const parts = pathname.split('/');
		const newUrl = parts[1] + '/' + parts[2] + '/' + parts[3] + (index ? '/' + index : '');
		const data = {
			newUrl,
			index,
		};
		hooks.fire('action:navigator.generateUrl', data);
		return data.newUrl;
	}

	navigator.getCount = () => count;

	navigator.setCount = function (value) {
		value = parseInt(value, 10);
		if (value === count) {
			return;
		}
		count = value;
		navigator.updateTextAndProgressBar();
		toggle(count > 0);
	};

	navigator.show = function () {
		toggle(true);
	};

	navigator.disable = function () {
		count = 0;
		index = 1;
		navigator.callback = null;
		navigator.selector = null;
		$(window).off('scroll', navigator.delayedUpdate);

		toggle(false);
	};

	function toggle(flag) {
		if (flag && (!ajaxify.data.template.topic && !ajaxify.data.template.category)) {
			return;
		}
		paginationBlockEl.toggleClass('ready', flag);
		paginationBlockEl.toggleClass('noreplies', count <= 1);
	}

	navigator.delayedUpdate = function () {
		if (!navigatorUpdateTimeoutId) {
			navigatorUpdateTimeoutId = setTimeout(function () {
				navigator.update();
				navigatorUpdateTimeoutId = undefined;
			}, 100);
		}
	};

	navigator.update = function () {
		let newIndex = index;
		const els = $(navigator.selector).filter((i, el) => !el.getAttribute('data-navigator-ignore'));
		if (els.length) {
			newIndex = parseInt(els.first().attr('data-index'), 10) + 1;
		}

		const scrollTop = $(window).scrollTop();
		const windowHeight = $(window).height();
		const documentHeight = $(document).height();
		const middleOfViewport = scrollTop + (windowHeight / 2);
		let previousDistance = Number.MAX_VALUE;
		els.each(function () {
			const $this = $(this);
			const elIndex = parseInt($this.attr('data-index'), 10);
			if (elIndex >= 0) {
				const distanceToMiddle = Math.abs(middleOfViewport - ($this.offset().top + ($this.outerHeight(true) / 2)));
				if (distanceToMiddle > previousDistance) {
					return false;
				}

				if (distanceToMiddle < previousDistance) {
					newIndex = elIndex + 1;
					previousDistance = distanceToMiddle;
				}
			}
		});

		const atTop = scrollTop === 0 && parseInt(els.first().attr('data-index'), 10) === 0;
		const nearBottom = scrollTop + windowHeight > documentHeight - 100 && parseInt(els.last().attr('data-index'), 10) === count - 1;

		if (atTop) {
			newIndex = 1;
		} else if (nearBottom) {
			newIndex = count;
		}

		hooks.fire('action:navigator.update', { newIndex, index });

		if (newIndex !== index) {
			if (typeof navigator.callback === 'function') {
				navigator.callback(newIndex, count);
			}
			index = newIndex;
			navigator.updateTextAndProgressBar();
			setThumbToIndex(index);
		}

		toggle(count > 0);
	};

	navigator.getIndex = () => index;

	navigator.setIndex = (newIndex) => {
		index = newIndex + 1;
		if (typeof navigator.callback === 'function') {
			navigator.callback(index, count);
		}
		navigator.updateTextAndProgressBar();
		setThumbToIndex(index);
	};

	navigator.updateTextAndProgressBar = function () {
		if (!utils.isNumber(index)) {
			return;
		}
		index = index > count ? count : index;
		if (config.usePagination) {
			paginationTextEl.html(`<i class="fa fa-file"></i> ${ajaxify.data.pagination.currentPage} / ${ajaxify.data.pagination.pageCount}`);
		} else {
			paginationTextEl.translateHtml('[[global:pagination.out-of, ' + index + ', ' + count + ']]');
		}

		const fraction = (index - 1) / (count - 1 || 1);
		paginationBlockMeterEl.val(fraction);
		paginationBlockProgressEl.width((fraction * 100) + '%');
	};

	navigator.scrollUp = function () {
		const $window = $(window);

		if (config.usePagination) {
			const atTop = $window.scrollTop() <= 0;
			if (atTop) {
				return pagination.previousPage(function () {
					$('body,html').scrollTop($(document).height() - $window.height());
				});
			}
		}
		$('body,html').animate({
			scrollTop: $window.scrollTop() - $window.height(),
		});
	};

	navigator.scrollDown = function () {
		const $window = $(window);

		if (config.usePagination) {
			const atBottom = $window.scrollTop() >= $(document).height() - $window.height();
			if (atBottom) {
				return pagination.nextPage();
			}
		}
		$('body,html').animate({
			scrollTop: $window.scrollTop() + $window.height(),
		});
	};

	navigator.scrollTop = function (index) {
		if ($(`${navigator.selector}[data-index="${index}"]:not([data-navigator-ignore])`).length) {
			navigator.scrollToIndex(index, true);
		} else {
			ajaxify.go(generateUrl());
		}
	};

	navigator.scrollBottom = function (index) {
		if (parseInt(index, 10) < 0) {
			return;
		}

		if ($(`${navigator.selector}[data-index="${index}"]:not([data-navigator-ignore])`).length) {
			navigator.scrollToIndex(index, true);
		} else {
			index = parseInt(index, 10) + 1;
			ajaxify.go(generateUrl(index));
		}
	};

	navigator.scrollToIndex = function (index, highlight, duration) {
		const inTopic = ajaxify.data.template.topic;
		const inCategory = ajaxify.data.template.category;

		if (!utils.isNumber(index) || (!inTopic && !inCategory)) {
			return;
		}

		duration = duration !== undefined ? duration : 400;
		navigator.scrollActive = true;

		// if in topic and item already on page
		if (inTopic && components.get('post/anchor', index).length) {
			return navigator.scrollToPostIndex(index, highlight, duration);
		}

		// if in category and item alreay on page
		if (inCategory && $('[component="category/topic"][data-index="' + index + '"]').length) {
			return navigator.scrollToTopicIndex(index, highlight, duration);
		}

		if (!config.usePagination) {
			navigator.scrollActive = false;
			index = parseInt(index, 10) + 1;
			ajaxify.go(generateUrl(index));
			return;
		}

		const scrollMethod = inTopic ? navigator.scrollToPostIndex : navigator.scrollToTopicIndex;

		const page = 1 + Math.floor(index / config.postsPerPage);
		if (parseInt(page, 10) !== ajaxify.data.pagination.currentPage) {
			pagination.loadPage(page, function () {
				scrollMethod(index, highlight, duration);
			});
		} else {
			scrollMethod(index, highlight, duration);
		}
	};

	navigator.shouldScrollToPost = function (postIndex) {
		if (!ajaxify.data.template.topic || postIndex <= 1) {
			return false;
		}
		const firstPostEl = $('[component="topic"] [component="post"]').first();
		return parseInt(firstPostEl.attr('data-index'), 10) !== postIndex - 1;
	};

	navigator.scrollToPostIndex = function (postIndex, highlight, duration) {
		const scrollTo = $(`[component="post"][data-index="${postIndex}"]:not([data-navigator-ignore])`);
		navigator.scrollToElement(scrollTo, highlight, duration, postIndex);
	};

	navigator.scrollToTopicIndex = function (topicIndex, highlight, duration) {
		const scrollTo = $('[component="category/topic"][data-index="' + topicIndex + '"]');
		navigator.scrollToElement(scrollTo, highlight, duration, topicIndex);
	};

	navigator.scrollToElement = async (scrollTo, highlight, duration, newIndex = null) => {
		if (!scrollTo.length) {
			navigator.scrollActive = false;
			return;
		}

		await hooks.fire('filter:navigator.scroll', { scrollTo, highlight, duration, newIndex: newIndex + 1 });

		const postHeight = scrollTo.outerHeight(true);
		const navbarHeight = components.get('navbar').outerHeight(true) || 0;
		const topicHeaderHeight = $('.topic-main-buttons').outerHeight(true) || 0;
		const viewportHeight = $(window).height();

		// Temporarily disable navigator update on scroll
		$(window).off('scroll', navigator.delayedUpdate);

		duration = duration !== undefined ? duration : 400;
		navigator.scrollActive = true;
		let done = false;

		function animateScroll() {
			function reenableScroll() {
				// Re-enable onScroll behaviour
				setTimeout(() => { // fixes race condition from jQuery — onAnimateComplete called too quickly
					$(window).off('scroll', navigator.delayedUpdate)
						.on('scroll', navigator.delayedUpdate);

					hooks.fire('action:navigator.scrolled', { scrollTo, highlight, duration, newIndex: newIndex + 1 });
				}, 50);
			}
			function onAnimateComplete() {
				if (done) {
					reenableScroll();
					return;
				}
				done = true;

				navigator.scrollActive = false;
				highlightPost();

				if (!newIndex) {
					navigator.update();
				} else {
					navigator.setIndex(newIndex);
				}
			}

			let scrollTop = 0;
			if (postHeight < viewportHeight - navbarHeight - topicHeaderHeight) {
				scrollTop = scrollTo.offset().top - (viewportHeight / 2) + (postHeight / 2);
			} else {
				scrollTop = scrollTo.offset().top - navbarHeight - topicHeaderHeight;
			}

			if (duration === 0) {
				$(window).scrollTop(scrollTop);
				onAnimateComplete();
				reenableScroll();
				return;
			}
			$('html, body').animate({
				scrollTop: scrollTop + 'px',
			}, duration, onAnimateComplete);
		}

		function highlightPost() {
			if (highlight) {
				$('[component="post"],[component="category/topic"]').removeClass('highlight');
				scrollTo.addClass('highlight');
				setTimeout(function () {
					scrollTo.removeClass('highlight');
				}, 10000);
			}
		}

		animateScroll();
	};

	return navigator;
});

