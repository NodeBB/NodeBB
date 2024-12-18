'use strict';


define('forum/topic', [
	'forum/infinitescroll',
	'forum/topic/threadTools',
	'forum/topic/postTools',
	'forum/topic/events',
	'forum/topic/posts',
	'navigator',
	'sort',
	'quickreply',
	'components',
	'storage',
	'hooks',
	'api',
	'alerts',
	'bootbox',
	'clipboard',
], function (
	infinitescroll, threadTools, postTools,
	events, posts, navigator, sort, quickreply,
	components, storage, hooks, api, alerts,
	bootbox, clipboard
) {
	const Topic = {};
	let tid = 0;
	let currentUrl = '';

	$(window).on('action:ajaxify.start', function (ev, data) {
		events.removeListeners();

		if (!String(data.url).startsWith('topic/')) {
			navigator.disable();
			components.get('navbar/title').find('span').text('').hide();
			alerts.remove('bookmark');
		}
	});

	Topic.init = async function () {
		const tidChanged = !tid || parseInt(tid, 10) !== parseInt(ajaxify.data.tid, 10);
		tid = ajaxify.data.tid;
		currentUrl = ajaxify.currentPage;
		hooks.fire('action:topic.loading');

		app.enterRoom('topic_' + tid);

		if (tidChanged) {
			posts.signaturesShown = {};
		}
		await posts.onTopicPageLoad(components.get('post'));
		navigator.init('[component="topic"]>[component="post"]', ajaxify.data.postcount, Topic.toTop, Topic.toBottom, Topic.navigatorCallback);

		postTools.init(tid);
		threadTools.init(tid, $('.topic'));
		events.init();

		sort.handleSort('topicPostSort', 'topic/' + ajaxify.data.slug);

		if (!config.usePagination) {
			infinitescroll.init($('[component="topic"]'), posts.loadMorePosts);
		}

		addBlockQuoteHandler();
		addCodeBlockHandler();
		addParentHandler();
		addRepliesHandler();
		addPostsPreviewHandler();
		setupQuickReply();
		handleBookmark(tid);
		handleThumbs();

		$(window).on('scroll', utils.debounce(updateTopicTitle, 250));

		handleTopicSearch();

		hooks.fire('action:topic.loaded', ajaxify.data);
	};

	function handleTopicSearch() {
		require(['mousetrap'], (mousetrap) => {
			if (config.topicSearchEnabled) {
				require(['search'], function (search) {
					mousetrap.bind(['command+f', 'ctrl+f'], function (e) {
						e.preventDefault();
						let form = $('[component="navbar"] [component="search/form"]');
						if (!form.length) { // harmony
							form = $('[component="sidebar/right"] [component="search/form"]');
						}
						form.find('[component="search/fields"] input[name="query"]').val('in:topic-' + ajaxify.data.tid + ' ');
						search.showAndFocusInput(form);
					});

					hooks.onPage('action:ajaxify.cleanup', () => {
						mousetrap.unbind(['command+f', 'ctrl+f']);
					});
				});
			}

			mousetrap.bind('j', (e) => {
				if (e.target.classList.contains('mousetrap')) {
					return;
				}

				const index = navigator.getIndex();
				const count = navigator.getCount();
				if (index === count) {
					return;
				}

				navigator.scrollToIndex(index, true, 0);
			});

			mousetrap.bind('k', (e) => {
				if (e.target.classList.contains('mousetrap')) {
					return;
				}

				const index = navigator.getIndex();
				if (index === 1) {
					return;
				}
				navigator.scrollToIndex(index - 2, true, 0);
			});
		});
	}

	Topic.toTop = function () {
		navigator.scrollTop(0);
	};

	Topic.toBottom = function () {
		socket.emit('topics.postcount', ajaxify.data.tid, function (err, postCount) {
			if (err) {
				return alerts.error(err);
			}

			navigator.scrollBottom(postCount - 1);
		});
	};

	function handleBookmark(tid) {
		if (window.location.hash) {
			const el = $(utils.escapeHTML(window.location.hash));
			if (el.length) {
				const postEl = el.parents('[data-pid]');
				return navigator.scrollToElement(postEl, true, 0);
			}
		}
		const bookmark = ajaxify.data.bookmark || storage.getItem('topic:' + tid + ':bookmark');
		const postIndex = ajaxify.data.postIndex;
		updateUserBookmark(postIndex);
		if (navigator.shouldScrollToPost(postIndex)) {
			return navigator.scrollToPostIndex(postIndex - 1, true, 0);
		} else if (bookmark && (
			!config.usePagination ||
			(config.usePagination && ajaxify.data.pagination.currentPage === 1)
		) && ajaxify.data.postcount > ajaxify.data.bookmarkThreshold) {
			alerts.alert({
				alert_id: 'bookmark',
				message: '[[topic:bookmark-instructions]]',
				timeout: 15000,
				type: 'info',
				clickfn: function () {
					navigator.scrollToIndex(Math.max(0, parseInt(bookmark, 10) - 1), true);
				},
				closefn: function () {
					storage.removeItem('topic:' + tid + ':bookmark');
				},
			});
		}
	}

	function handleThumbs() {
		const listEl = document.querySelector('[component="topic/thumb/list"]');
		if (!listEl) {
			return;
		}

		listEl.addEventListener('click', async (e) => {
			const clickedThumb = e.target.closest('a');
			if (clickedThumb) {
				const clickedThumbIndex = Array.from(clickedThumb.parentNode.children).indexOf(clickedThumb);
				e.stopPropagation();
				e.preventDefault();
				const thumbs = ajaxify.data.thumbs.map(t => ({ ...t }));
				thumbs.forEach((t, i) => {
					t.selected = i === clickedThumbIndex;
				});
				const html = await app.parseAndTranslate('modals/topic-thumbs-view', {
					src: clickedThumb.href,
					thumbs: thumbs,
				});

				const modal = bootbox.dialog({
					size: 'lg',
					onEscape: true,
					backdrop: true,
					message: html,
				});
				modal.on('click', '[component="topic/thumb/select"]', function () {
					$('[component="topic/thumb/select"]').removeClass('border-primary');
					$(this).addClass('border-primary');
					$('[component="topic/thumb/current"]')
						.attr('src', $(this).attr('src'));
				});
			}
		});
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

	function addCodeBlockHandler() {
		new clipboard('[component="copy/code/btn"]', {
			text: function (trigger) {
				const btn = $(trigger);
				btn.find('i').removeClass('fa-copy').addClass('fa-check');
				setTimeout(() => btn.find('i').removeClass('fa-check').addClass('fa-copy'), 2000);
				const codeEl = btn.parent().find('code');
				if (codeEl.attr('data-lines') && codeEl.find('.hljs-ln-code[data-line-number]').length) {
					return codeEl.find('.hljs-ln-code[data-line-number]')
						.map((i, e) => e.textContent).get().join('\n');
				}
				return codeEl.text();
			},
		});

		function addCopyCodeButton() {
			function scrollbarVisible(element) {
				return element.scrollHeight > element.clientHeight;
			}
			function offsetCodeBtn(codeEl) {
				if (!codeEl.length) { return; }
				if (!codeEl[0].scrollHeight) {
					return setTimeout(offsetCodeBtn, 100, codeEl);
				}
				if (scrollbarVisible(codeEl.get(0))) {
					codeEl.parent().parent().find('[component="copy/code/btn"]').css({ margin: '0.5rem 1.5rem 0 0' });
				}
			}
			let codeBlocks = $('[component="topic"] [component="post/content"] code:not([data-button-added])');
			codeBlocks = codeBlocks.filter((i, el) => $(el).text().includes('\n'));
			const container = $('<div class="hover-parent position-relative"></div>');
			const buttonDiv = $('<button component="copy/code/btn" class="hover-visible position-absolute top-0 btn btn-sm btn-outline-secondary" style="right: 0px; margin: 0.5rem 0.5rem 0 0;"><i class="fa fa-fw fa-copy"></i></button>');
			const preEls = codeBlocks.parent();
			preEls.wrap(container).parent().append(buttonDiv);
			preEls.parent().find('[component="copy/code/btn"]').translateAttr('title', '[[topic:copy-code]]');
			preEls.each((index, el) => {
				offsetCodeBtn($(el).find('code'));
			});
			codeBlocks.attr('data-button-added', 1);
		}
		hooks.registerPage('action:posts.loaded', addCopyCodeButton);
		hooks.registerPage('action:topic.loaded', addCopyCodeButton);
		hooks.registerPage('action:posts.edited', addCopyCodeButton);
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
		let destroyed = false;
		const postCache = {};
		function destroyTooltip() {
			clearTimeout(timeoutId);
			$('#post-tooltip').remove();
			destroyed = true;
		}
		$(window).one('action:ajaxify.start', destroyTooltip);
		$('[component="topic"]').on('mouseenter', '[component="post/parent"], [component="post/content"] a, [component="topic/event"] a', async function () {
			const link = $(this);
			destroyed = false;

			async function renderPost(pid) {
				const postData = postCache[pid] || await api.get(`/posts/${pid}/summary`);
				$('#post-tooltip').remove();
				if (postData && ajaxify.data.template.topic) {
					postCache[pid] = postData;
					const tooltip = await app.parseAndTranslate('partials/topic/post-preview', { post: postData });
					if (destroyed) {
						return;
					}
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
			const location = utils.urlToLocation(href);
			const pathname = location.pathname;
			const validHref = href && href !== '#' && window.location.hostname === location.hostname;
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
		}).on('mouseleave', '[component="post"] a, [component="topic/event"] a', destroyTooltip);
	}

	function setupQuickReply() {
		if (config.enableQuickReply || (config.theme && config.theme.enableQuickReply)) {
			quickreply.init();
		}
	}

	function updateTopicTitle() {
		const span = components.get('navbar/title').find('span');
		if ($(window).scrollTop() > 50 && span.hasClass('hidden')) {
			span.html(ajaxify.data.title).removeClass('hidden');
		} else if ($(window).scrollTop() <= 50 && !span.hasClass('hidden')) {
			span.html('').addClass('hidden');
		}
		if ($(window).scrollTop() > 300) {
			alerts.remove('bookmark');
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
				api.put(`/topics/${ajaxify.data.tid}/read`);
			}

			updateUserBookmark(index);

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
				ajaxify.data.bookmark = Math.min(index, ajaxify.data.postcount);

				socket.emit('topics.bookmark', {
					tid: ajaxify.data.tid,
					index: ajaxify.data.bookmark,
				}, function (err) {
					if (err) {
						ajaxify.data.bookmark = currentBookmark;
						return alerts.error(err);
					}
				});
			} else {
				storage.setItem(bookmarkKey, index);
			}
		}

		// removes the bookmark alert when we get to / past the bookmark
		if (!currentBookmark || parseInt(index, 10) >= parseInt(currentBookmark, 10)) {
			alerts.remove('bookmark');
		}
	}


	return Topic;
});
