'use strict';


define('forum/topic', [
	'forum/infinitescroll',
	'forum/topic/threadTools',
	'forum/topic/postTools',
	'forum/topic/events',
	'forum/topic/posts',
	'navigator',
	'sort',
	'components',
	'storage',
	'hooks',
	'api',
], function (
	infinitescroll, threadTools, postTools,
	events, posts, navigator, sort,
	components, storage, hooks, api
) {
	const Topic = {};
	let currentUrl = '';

	$(window).on('action:ajaxify.start', function (ev, data) {
		events.removeListeners();

		if (!String(data.url).startsWith('topic/')) {
			navigator.disable();
			components.get('navbar/title').find('span').text('').hide();
			app.removeAlert('bookmark');
		}
	});

	Topic.init = function () {
		const tid = ajaxify.data.tid;
		currentUrl = ajaxify.currentPage;
		hooks.fire('action:topic.loading');

		app.enterRoom('topic_' + tid);

		posts.onTopicPageLoad(components.get('post'));

		navigator.init('[component="post"]', ajaxify.data.postcount, Topic.toTop, Topic.toBottom, utils.debounce(Topic.navigatorCallback, 500));

		postTools.init(tid);
		threadTools.init(tid, $('.topic'));
		events.init();

		sort.handleSort('topicPostSort', 'topic/' + ajaxify.data.slug);

		if (!config.usePagination) {
			infinitescroll.init($('[component="topic"]'), posts.loadMorePosts);
		}

		addBlockQuoteHandler();
		addParentHandler();
		addDropupHandler();
		addRepliesHandler();
		addPostsPreviewHandler();

		handleBookmark(tid);

		$(window).on('scroll', utils.debounce(updateTopicTitle, 250));

		handleTopicSearch();

		hooks.fire('action:topic.loaded', ajaxify.data);
	};

	function handleTopicSearch() {
		if (config.topicSearchEnabled) {
			require(['mousetrap'], function (mousetrap) {
				mousetrap.bind(['command+f', 'ctrl+f'], function (e) {
					if (ajaxify.data.template.topic) {
						e.preventDefault();
						$('#search-fields input').val('in:topic-' + ajaxify.data.tid + ' ');
						app.prepareSearch();
					}
				});
			});
		}
	}

	Topic.toTop = function () {
		navigator.scrollTop(0);
	};

	Topic.toBottom = function () {
		socket.emit('topics.postcount', ajaxify.data.tid, function (err, postCount) {
			if (err) {
				return app.alertError(err.message);
			}

			navigator.scrollBottom(postCount - 1);
		});
	};

	function handleBookmark(tid) {
		if (window.location.hash) {
			const el = $(utils.escapeHTML(window.location.hash));
			if (el.length) {
				return navigator.scrollToElement(el, true, 0);
			}
		}
		const bookmark = ajaxify.data.bookmark || storage.getItem('topic:' + tid + ':bookmark');
		const postIndex = ajaxify.data.postIndex;

		if (postIndex > 1) {
			if (components.get('post/anchor', postIndex - 1).length) {
				return navigator.scrollToPostIndex(postIndex - 1, true, 0);
			}
		} else if (bookmark && (
			!config.usePagination ||
			(config.usePagination && ajaxify.data.pagination.currentPage === 1)
		) && ajaxify.data.postcount > ajaxify.data.bookmarkThreshold) {
			app.alert({
				alert_id: 'bookmark',
				message: '[[topic:bookmark_instructions]]',
				timeout: 0,
				type: 'info',
				clickfn: function () {
					navigator.scrollToIndex(parseInt(bookmark, 10), true);
				},
				closefn: function () {
					storage.removeItem('topic:' + tid + ':bookmark');
				},
			});
			setTimeout(function () {
				app.removeAlert('bookmark');
			}, 10000);
		}
	}

	function addBlockQuoteHandler() {
		components.get('topic').on('click', 'blockquote .toggle', function () {
			const blockQuote = $(this).parent('blockquote');
			const toggle = $(this);
			blockQuote.toggleClass('uncollapsed');
			const collapsed = !blockQuote.hasClass('uncollapsed');
			toggle.toggleClass('fa-angle-down', collapsed).toggleClass('fa-angle-up', !collapsed);
		});
	}

	function addParentHandler() {
		components.get('topic').on('click', '[component="post/parent"]', function (e) {
			const toPid = $(this).attr('data-topid');

			const toPost = $('[component="topic"]>[component="post"][data-pid="' + toPid + '"]');
			if (toPost.length) {
				e.preventDefault();
				navigator.scrollToIndex(toPost.attr('data-index'), true);
				return false;
			}
		});
	}

	function addDropupHandler() {
		// Locate all dropdowns
		const target = $('#content .dropdown-menu').parent();

		// Toggle dropup if past 50% of screen
		$(target).on('show.bs.dropdown', function () {
			const dropUp = this.getBoundingClientRect().top > ($(window).height() / 2);
			$(this).toggleClass('dropup', dropUp);
		});
	}

	function addRepliesHandler() {
		$('[component="topic"]').on('click', '[component="post/reply-count"]', function () {
			const btn = $(this);
			require(['forum/topic/replies'], function (replies) {
				replies.init(btn);
			});
		});
	}

	function addPostsPreviewHandler() {
		if (!ajaxify.data.showPostPreviewsOnHover || utils.isMobile()) {
			return;
		}
		let timeoutId = 0;
		const postCache = {};
		$(window).one('action:ajaxify.start', function () {
			clearTimeout(timeoutId);
			$('#post-tooltip').remove();
		});
		$('[component="topic"]').on('mouseenter', '[component="post"] a, [component="topic/event"] a', async function () {
			const link = $(this);

			async function renderPost(pid) {
				const postData = postCache[pid] || await socket.emit('posts.getPostSummaryByPid', { pid: pid });
				if (postData) {
					postCache[pid] = postData;
					const tooltip = await app.parseAndTranslate('partials/topic/post-preview', { post: postData });
					tooltip.hide().find('.timeago').timeago();
					tooltip.appendTo($('body')).fadeIn(300);
					const postContent = link.parents('[component="topic"]').find('[component="post/content"]').first();
					const postRect = postContent.offset();
					const postWidth = postContent.width();
					const linkRect = link.offset();
					tooltip.css({
						top: linkRect.top + 30,
						left: postRect.left,
						width: postWidth,
					});
				}
			}

			const href = link.attr('href');
			const validHref = href && href !== '#';
			const pathname = utils.urlToLocation(href).pathname;
			$('#post-tooltip').remove();
			const postMatch = validHref && pathname && pathname.match(/\/post\/([\d]+)/);
			const topicMatch = validHref && pathname && pathname.match(/\/topic\/([\d]+)/);
			if (postMatch) {
				const pid = postMatch[1];
				if (parseInt(link.parents('[component="post"]').attr('data-pid'), 10) === parseInt(pid, 10)) {
					return; // dont render self post
				}

				timeoutId = setTimeout(async () => {
					renderPost(pid);
				}, 300);
			} else if (topicMatch) {
				timeoutId = setTimeout(async () => {
					const tid = topicMatch[1];
					const topicData = await api.get('/topics/' + tid, {});
					renderPost(topicData.mainPid);
				}, 300);
			}
		}).on('mouseleave', '[component="post"] a, [component="topic/event"] a', function () {
			clearTimeout(timeoutId);
			$('#post-tooltip').remove();
		});
	}

	function updateTopicTitle() {
		const span = components.get('navbar/title').find('span');
		if ($(window).scrollTop() > 50 && span.hasClass('hidden')) {
			span.html(ajaxify.data.title).removeClass('hidden');
		} else if ($(window).scrollTop() <= 50 && !span.hasClass('hidden')) {
			span.html('').addClass('hidden');
		}
		if ($(window).scrollTop() > 300) {
			app.removeAlert('bookmark');
		}
	}

	Topic.navigatorCallback = function (index, elementCount) {
		if (!ajaxify.data.template.topic || navigator.scrollActive) {
			return;
		}

		const newUrl = 'topic/' + ajaxify.data.slug + (index > 1 ? ('/' + index) : '');
		if (newUrl !== currentUrl) {
			currentUrl = newUrl;

			if (index >= elementCount && app.user.uid) {
				socket.emit('topics.markAsRead', [ajaxify.data.tid]);
			}

			updateUserBookmark(index);

			Topic.replaceURLTimeout = 0;
			if (ajaxify.data.updateUrlWithPostIndex && history.replaceState) {
				let search = window.location.search || '';
				if (!config.usePagination) {
					search = (search && !/^\?page=\d+$/.test(search) ? search : '');
				}

				history.replaceState({
					url: newUrl + search,
				}, null, window.location.protocol + '//' + window.location.host + config.relative_path + '/' + newUrl + search);
			}
		}
	};

	function updateUserBookmark(index) {
		const bookmarkKey = 'topic:' + ajaxify.data.tid + ':bookmark';
		const currentBookmark = ajaxify.data.bookmark || storage.getItem(bookmarkKey);
		if (config.topicPostSort === 'newest_to_oldest') {
			index = Math.max(1, ajaxify.data.postcount - index + 2);
		}

		if (
			ajaxify.data.postcount > ajaxify.data.bookmarkThreshold &&
			(
				!currentBookmark ||
				parseInt(index, 10) > parseInt(currentBookmark, 10) ||
				ajaxify.data.postcount < parseInt(currentBookmark, 10)
			)
		) {
			if (app.user.uid) {
				socket.emit('topics.bookmark', {
					tid: ajaxify.data.tid,
					index: index,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					ajaxify.data.bookmark = index + 1;
				});
			} else {
				storage.setItem(bookmarkKey, index);
			}
		}

		// removes the bookmark alert when we get to / past the bookmark
		if (!currentBookmark || parseInt(index, 10) >= parseInt(currentBookmark, 10)) {
			app.removeAlert('bookmark');
		}
	}


	return Topic;
});
