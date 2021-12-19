'use strict';

define('navigator', ['forum/pagination', 'components', 'hooks', 'alerts'], function (pagination, components, hooks, alerts) {
	const navigator = {};
	let index = 0;
	let count = 0;
	let navigatorUpdateTimeoutId;

	let renderPostIntervalId;
	let touchX;
	let touchY;
	let renderPostIndex;
	let isNavigating = false;
	let firstMove = true;

	navigator.scrollActive = false;

	let paginationBlockEl = $('.pagination-block');
	let paginationTextEl = paginationBlockEl.find('.pagination-text');
	let paginationBlockMeterEl = paginationBlockEl.find('meter');
	let paginationBlockProgressEl = paginationBlockEl.find('.progress-bar');
	let thumb;
	let thumbText;
	let thumbIcon;
	let thumbIconHeight;
	let thumbIconHalfHeight;

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

		thumbIcon = $('.scroller-thumb-icon');
		thumbIconHeight = thumbIcon.height();
		thumbIconHalfHeight = thumbIconHeight / 2;
		thumb = $('.scroller-thumb');
		thumbText = thumb.find('.thumb-text');


		$(window).off('scroll', navigator.delayedUpdate).on('scroll', navigator.delayedUpdate);

		paginationBlockEl.find('.dropdown-menu').off('click').on('click', function (e) {
			e.stopPropagation();
		});

		paginationBlockEl.off('shown.bs.dropdown', '.dropdown').on('shown.bs.dropdown', '.dropdown', function () {
			setTimeout(function () {
				$('.pagination-block input').focus();
			}, 100);
		});
		paginationBlockEl.find('.pageup').off('click').on('click', navigator.scrollUp);
		paginationBlockEl.find('.pagedown').off('click').on('click', navigator.scrollDown);
		paginationBlockEl.find('.pagetop').off('click').on('click', navigator.toTop);
		paginationBlockEl.find('.pagebottom').off('click').on('click', navigator.toBottom);

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
				$('.pagination-block .dropdown-toggle').trigger('click');
				ajaxify.go(url);
			}
		});

		if (ajaxify.data.template.topic) {
			handleScrollNav();
		}

		handleKeys();

		navigator.setCount(count);
		navigator.update(0);
	};

	function clampTop(newTop) {
		const parent = thumb.parent();
		const parentOffset = parent.offset();
		if (newTop < parentOffset.top) {
			newTop = parentOffset.top;
		} else if (newTop > parentOffset.top + parent.height() - thumbIconHeight) {
			newTop = parentOffset.top + parent.height() - thumbIconHeight;
		}
		return newTop;
	}

	function setThumbToIndex(index) {
		if (!thumb.length || thumb.is(':hidden')) {
			return;
		}
		const parent = thumb.parent();
		const parentOffset = parent.offset();
		let percent = (index - 1) / ajaxify.data.postcount;
		if (index === count) {
			percent = 1;
		}
		const newTop = clampTop(parentOffset.top + ((parent.height() - thumbIconHeight) * percent));

		const offset = { top: newTop, left: thumb.offset().left };
		thumb.offset(offset);
		thumbText.text(index + '/' + ajaxify.data.postcount);
		renderPost(index);
	}

	function handleScrollNav() {
		if (!thumb.length) {
			return;
		}

		const parent = thumb.parent();
		parent.on('click', function (ev) {
			if ($(ev.target).hasClass('scroller-container')) {
				const index = calculateIndexFromY(ev.pageY);
				navigator.scrollToIndex(index - 1, true, 0);
				return false;
			}
		});

		function calculateIndexFromY(y) {
			const newTop = clampTop(y - thumbIconHalfHeight);
			const parentOffset = parent.offset();
			const percent = (newTop - parentOffset.top) / (parent.height() - thumbIconHeight);
			index = Math.max(1, Math.ceil(ajaxify.data.postcount * percent));
			return index > ajaxify.data.postcount ? ajaxify.data.count : index;
		}

		let mouseDragging = false;
		hooks.on('action:ajaxify.end', function () {
			renderPostIndex = null;
		});
		$('.pagination-block .dropdown-menu').parent().on('shown.bs.dropdown', function () {
			setThumbToIndex(index);
		});

		thumb.on('mousedown', function () {
			mouseDragging = true;
			$(window).on('mousemove', mousemove);
			firstMove = true;
		});

		function mouseup() {
			$(window).off('mousemove', mousemove);
			if (mouseDragging) {
				navigator.scrollToIndex(index - 1, true, 0);
				paginationBlockEl.find('[data-toggle="dropdown"]').trigger('click');
			}
			clearRenderInterval();
			mouseDragging = false;
			firstMove = false;
		}

		function mousemove(ev) {
			const newTop = clampTop(ev.pageY - thumbIconHalfHeight);
			thumb.offset({ top: newTop, left: thumb.offset().left });
			const index = calculateIndexFromY(ev.pageY);
			navigator.updateTextAndProgressBar();
			thumbText.text(index + '/' + ajaxify.data.postcount);
			if (firstMove) {
				delayedRenderPost();
			}
			firstMove = false;
			ev.stopPropagation();
			return false;
		}

		function delayedRenderPost() {
			clearRenderInterval();
			renderPostIntervalId = setInterval(function () {
				renderPost(index);
			}, 250);
		}

		$(window).off('mousemove', mousemove);
		$(window).off('mouseup', mouseup).on('mouseup', mouseup);

		thumb.on('touchstart', function (ev) {
			isNavigating = true;
			touchX = Math.min($(window).width(), Math.max(0, ev.touches[0].clientX));
			touchY = Math.min($(window).height(), Math.max(0, ev.touches[0].clientY));
			firstMove = true;
		});

		thumb.on('touchmove', function (ev) {
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
				const newTop = clampTop(touchY + $(window).scrollTop() - thumbIconHalfHeight);
				thumb.offset({ top: newTop, left: thumb.offset().left });
				const index = calculateIndexFromY(touchY + $(window).scrollTop());
				navigator.updateTextAndProgressBar();
				thumbText.text(index + '/' + ajaxify.data.postcount);
				if (firstMove) {
					renderPost(index);
				}
			}
			firstMove = false;
		});

		thumb.on('touchend', function () {
			clearRenderInterval();
			if (isNavigating) {
				navigator.scrollToIndex(index - 1, true, 0);
				isNavigating = false;
				paginationBlockEl.find('[data-toggle="dropdown"]').trigger('click');
			}
		});
	}

	function clearRenderInterval() {
		if (renderPostIntervalId) {
			clearInterval(renderPostIntervalId);
			renderPostIntervalId = 0;
		}
	}

	function renderPost(index, callback) {
		callback = callback || function () {};
		if (renderPostIndex === index || paginationBlockEl.find('.post-content').is(':hidden')) {
			return;
		}
		renderPostIndex = index;

		socket.emit('posts.getPostSummaryByIndex', { tid: ajaxify.data.tid, index: index - 1 }, function (err, postData) {
			if (err) {
				return alerts.error(err);
			}
			app.parseAndTranslate('partials/topic/navigation-post', { post: postData }, function (html) {
				paginationBlockEl
					.find('.post-content')
					.html(html)
					.find('.timeago').timeago();
			});

			callback();
		});
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
		return parts[1] + '/' + parts[2] + '/' + parts[3] + (index ? '/' + index : '');
	}

	navigator.setCount = function (value) {
		value = parseInt(value, 10);
		if (value === count) {
			return;
		}
		count = value;
		navigator.updateTextAndProgressBar();
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
		const path = ajaxify.removeRelativePath(window.location.pathname.slice(1));
		if (flag && (!path.startsWith('topic') && !path.startsWith('category'))) {
			return;
		}

		paginationBlockEl.toggleClass('ready', flag);
	}

	navigator.delayedUpdate = function () {
		if (!navigatorUpdateTimeoutId) {
			navigatorUpdateTimeoutId = setTimeout(function () {
				navigator.update();
				navigatorUpdateTimeoutId = undefined;
			}, 100);
		}
	};

	navigator.update = function (threshold) {
		/*
			The "threshold" is defined as the distance from the top of the page to
			a spot where a user is expecting to begin reading.
		*/
		threshold = typeof threshold === 'number' ? threshold : undefined;
		let newIndex = index;
		const els = $(navigator.selector);
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

		// If a threshold is undefined, try to determine one based on new index
		if (threshold === undefined && ajaxify.data.template.topic) {
			if (atTop) {
				threshold = 0;
			} else {
				const anchorEl = components.get('post/anchor', index - 1);
				if (anchorEl.length) {
					const anchorRect = anchorEl.get(0).getBoundingClientRect();
					threshold = anchorRect.top;
				}
			}
		}

		if (typeof navigator.callback === 'function') {
			navigator.callback(newIndex, count, threshold);
		}

		if (newIndex !== index) {
			index = newIndex;
			navigator.updateTextAndProgressBar();
			setThumbToIndex(index);
		}

		toggle(!!count);
	};

	navigator.updateTextAndProgressBar = function () {
		if (!utils.isNumber(index)) {
			return;
		}
		index = index > count ? count : index;
		paginationTextEl.translateHtml('[[global:pagination.out_of, ' + index + ', ' + count + ']]');
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
		if ($(navigator.selector + '[data-index="' + index + '"]').length) {
			navigator.scrollToIndex(index, true);
		} else {
			ajaxify.go(generateUrl());
		}
	};

	navigator.scrollBottom = function (index) {
		if (parseInt(index, 10) < 0) {
			return;
		}

		if ($(navigator.selector + '[data-index="' + index + '"]').length) {
			navigator.scrollToIndex(index, true);
		} else {
			index = parseInt(index, 10) + 1;
			ajaxify.go(generateUrl(index));
		}
	};

	navigator.scrollToIndex = function (index, highlight, duration) {
		const inTopic = !!components.get('topic').length;
		const inCategory = !!components.get('category').length;

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

	navigator.scrollToPostIndex = function (postIndex, highlight, duration) {
		const scrollTo = components.get('post', 'index', postIndex);
		navigator.scrollToElement(scrollTo, highlight, duration);
	};

	navigator.scrollToTopicIndex = function (topicIndex, highlight, duration) {
		const scrollTo = $('[component="category/topic"][data-index="' + topicIndex + '"]');
		navigator.scrollToElement(scrollTo, highlight, duration);
	};

	navigator.scrollToElement = function (scrollTo, highlight, duration) {
		if (!scrollTo.length) {
			navigator.scrollActive = false;
			return;
		}

		const postHeight = scrollTo.outerHeight(true);
		const navbarHeight = components.get('navbar').outerHeight(true);
		const topicHeaderHeight = $('.topic-header').outerHeight(true) || 0;
		const viewportHeight = $(window).height();

		// Temporarily disable navigator update on scroll
		$(window).off('scroll', navigator.delayedUpdate);

		duration = duration !== undefined ? duration : 400;
		navigator.scrollActive = true;
		let done = false;

		function animateScroll() {
			function reenableScroll() {
				// Re-enable onScroll behaviour
				$(window).on('scroll', navigator.delayedUpdate);
				const scrollToRect = scrollTo.get(0).getBoundingClientRect();
				navigator.update(scrollToRect.top);
			}
			function onAnimateComplete() {
				if (done) {
					reenableScroll();
					return;
				}
				done = true;

				navigator.scrollActive = false;
				highlightPost();
				$('body').scrollTop($('body').scrollTop() - 1);
				$('html').scrollTop($('html').scrollTop() - 1);
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

