'use strict';

define('forum/world', [
	'forum/infinitescroll', 'search', 'sort', 'hooks',
	'alerts', 'api', 'bootbox', 'helpers', 'forum/category/tools',
	'translator', 'quickreply', 'handleBack', 'imagesloaded',
], function (infinitescroll, search, sort, hooks,
	alerts, api, bootbox, helpers, categoryTools,
	translator, quickreply, handleBack, imagesLoaded) {
	const World = {};

	World.init = function () {
		app.enterRoom('world');
		quickreply.init({
			route: '/topics',
			body: {
				cid: config.activitypub.worldDefaultCid || ajaxify.data.cid,
			},
		});

		sort.handleSort('categoryTopicSort', 'world');
		handleImages();
		handleButtons();
		handleHelp();
		handleShowMoreButtons();

		categoryTools.init($('#world-feed'));
		socket.on('event:new_post', onNewPost);
		$(window).one('action:ajaxify.start', function () {
			categoryTools.removeListeners();
			socket.removeListener('event:new_post', onNewPost);
		});

		// Add label to sort
		const sortLabelEl = document.getElementById('sort-label');
		const sortOptionsEl = document.getElementById('sort-options');
		if (sortLabelEl && sortOptionsEl) {
			const params = new URLSearchParams(window.location.search);
			switch(params.get('sort')) {
				case 'popular': {
					translator.translate(`[[world:popular-${params.get('term')}]]`, function (translated) {
						sortLabelEl.innerText = translated;
					});
					break;
				}

				default: {
					let suffix = '';
					if (params.get('all') === '1') {
						suffix = '-all';
					} else if (params.get('local') === '1') {
						suffix = '-local';
					}
					translator.translate(`[[world:latest${suffix}]]`, function (translated) {
						sortLabelEl.innerText = translated;
					});
					break;
				}
			}
		}

		handleBack.init((after, handleBackCb) => {
			loadTopicsAfter(after, undefined, 1, (payload, callback) => {
				app.parseAndTranslate(ajaxify.data.template.name, 'posts', payload, function (html) {
					const listEl = document.getElementById('world-feed');
					$(listEl).append(html);
					imagesLoaded(listEl, () => {
						html.find('.timeago').timeago();
						handleImages();
						handleShowMoreButtons();
						callback();
						handleBackCb();
					});
				});
			});
		}, { container: '#world-feed' });

		search.enableQuickSearch({
			searchElements: {
				inputEl: $('[component="category-search"]'),
				resultEl: $('.world .quick-search-container'),
			},
			searchOptions: {
				in: 'categories',
			},
			dropdown: {
				maxWidth: '400px',
				maxHeight: '350px',
			},
			hideOnNoMatches: false,
		});

		if (!config.usePagination) {
			infinitescroll.init((direction) => {
				const posts = Array.from(document.querySelectorAll('[component="category/topic"]'));
				if (!posts.length) {
					return;
				}

				const afterEl = direction > 0 ? posts.pop() : posts.shift();
				const index = (parseInt(afterEl.getAttribute('data-index'), 10) || 0) + (direction > 0 ? 1 : 0);
				const after = afterEl.getAttribute('data-tid');
				if (index < config.topicsPerPage) {
					return;
				}

				loadTopicsAfter(index, after, direction, (payload, callback) => {
					app.parseAndTranslate(ajaxify.data.template.name, 'posts', payload, function (html) {
						const listEl = document.getElementById('world-feed');
						$(listEl)[direction === -1 ? 'prepend' : 'append'](html);
						html.find('.timeago').timeago();
						handleImages();
						handleShowMoreButtons();
						callback();
					});
				});
			});
		}

		ajaxify.data.categories.forEach(function (category) {
			handleIgnoreWatch(category.cid);
		});

		hooks.fire('action:topics.loaded', { topics: ajaxify.data.topics });
		hooks.fire('action:category.loaded', { cid: ajaxify.data.cid });
	};

	function calculateNextPage(after, direction) {
		return Math.floor(after / config.topicsPerPage) + (direction > 0 ? 1 : 0);
	}

	function loadTopicsAfter(index, referenceTid, direction, callback) {
		callback = callback || function () {};
		const query = utils.params();
		query.page = calculateNextPage(index, direction);
		query[direction > 0 ? 'after' : 'before'] = referenceTid;
		infinitescroll.loadMoreXhr(query, callback);
	}

	function handleButtons() {
		const feedEl = $('#world-feed');

		feedEl.on('click', '[data-action="bookmark"]', function () {
			const $this = $(this);
			const isBookmarked = $this.attr('data-bookmarked') === 'true';
			const pid = $this.attr('data-pid');
			const bookmarkCount = parseInt($this.attr('data-bookmarks'), 10);
			const method = isBookmarked ? 'del' : 'put';

			api[method](`/posts/${pid}/bookmark`, undefined, function (err) {
				if (err) {
					return alerts.error(err);
				}
				const type = isBookmarked ? 'unbookmark' : 'bookmark';
				const newBookmarkCount = bookmarkCount + (isBookmarked ? -1 : 1);
				$this.find('[component="bookmark-count"]').text(
					helpers.humanReadableNumber(newBookmarkCount)
				);
				$this.attr('data-bookmarks', newBookmarkCount);
				$this.attr('data-bookmarked', isBookmarked ? 'false' : 'true');
				$this.find('i').toggleClass('fa text-primary', !isBookmarked)
					.toggleClass('fa-regular text-muted', isBookmarked);
				hooks.fire(`action:post.${type}`, { pid: pid });
			});
		});

		feedEl.on('click', '[data-action="upvote"]', function () {
			const $this = $(this);
			const isUpvoted = $this.attr('data-upvoted') === 'true';
			const pid = $this.attr('data-pid');
			const upvoteCount = parseInt($this.attr('data-upvotes'), 10);
			const method = isUpvoted ? 'del' : 'put';
			const delta = 1;
			api[method](`/posts/${pid}/vote`, { delta }, function (err) {
				if (err) {
					return alerts.error(err);
				}

				const newUpvoteCount = upvoteCount + (isUpvoted ? -1 : 1);
				$this.find('[component="upvote-count"]').text(
					helpers.humanReadableNumber(newUpvoteCount)
				);
				$this.attr('data-upvotes', newUpvoteCount);
				$this.attr('data-upvoted', isUpvoted ? 'false' : 'true');
				$this.find('i').toggleClass('fa text-danger', !isUpvoted)
					.toggleClass('fa-regular text-muted', isUpvoted);

				hooks.fire('action:post.toggleVote', {
					pid: pid,
					delta: delta,
					unvote: method === 'del',
				});
			});
		});

		feedEl.on('click', '[data-action="reply"]', function () {
			const $this = $(this);
			const isMain = $this.attr('data-is-main') === 'true';
			app.newReply({
				tid: $this.attr('data-tid'),
				pid: !isMain ? $this.attr('data-pid') : undefined,
			}).catch(alerts.error);
		});
	}

	function handleHelp() {
		const trigger = document.getElementById('world-help');
		if (!trigger) {
			return;
		}

		const content = [
			'<p class="lead">[[world:help.intro]]</p>',
			'<p>[[world:help.fediverse]]</p>',
			'<p>[[world:help.build]]</p>',
			'<p>[[world:help.federating]]</p>',
			'<p>[[world:help.next-generation]]</p>',
		];

		trigger.addEventListener('click', () => {
			bootbox.dialog({
				title: '[[world:help.title]]',
				message: content.join('\n'),
				size: 'large',
			});
		});
	}

	function handleIgnoreWatch(cid) {
		const category = $('[data-cid="' + cid + '"]');
		category.find(
			'[component="category/watching"], [component="category/tracking"], [component="category/ignoring"], [component="category/notwatching"]'
		).on('click', async (e) => {
			const state = e.currentTarget.getAttribute('data-state');
			const { uid } = ajaxify.data;

			const { modified } = await api.put(`/categories/${encodeURIComponent(cid)}/watch`, { state, uid });
			updateDropdowns(modified, state);
			alerts.success('[[category:' + state + '.message]]');
		});
	}

	function handleImages() {
		$('[component="post/content"] img:not(.not-responsive)').addClass('img-fluid');
	}

	function handleShowMoreButtons() {
		const feedEl = document.getElementById('world-feed');
		if (!feedEl) {
			return;
		}

		feedEl.querySelectorAll('[component="post/content"]').forEach((el) => {
			const initted = el.getAttribute('data-showmore');
			if (parseInt(initted, 10) === 1) {
				return;
			}

			if (el.clientHeight < el.scrollHeight - 1) {
				el.parentNode.querySelector('[component="show/more"]').classList.remove('hidden');
				el.classList.toggle('clamp-fade-6', true);
			}
			el.setAttribute('data-showmore', '1');
		});

		if (parseInt(feedEl.getAttribute('data-showmore'), 10) !== 1) {
			feedEl.addEventListener('click', (e) => {
				const subselector = e.target.closest('[component="show/more"]');
				if (subselector) {
					const postContent = subselector.closest('.post-body').querySelector('[component="post/content"]');
					const isShowingMore = parseInt(subselector.getAttribute('ismore'), 10) === 1;
					postContent.classList.toggle('line-clamp-6', isShowingMore);
					postContent.classList.toggle('clamp-fade-6', isShowingMore);
					$(subselector).translateText(isShowingMore ? '[[world:see-more]]' : '[[world:see-less]]');
					subselector.setAttribute('ismore', isShowingMore ? 0 : 1);
				}
			});
			feedEl.setAttribute('data-showmore', '1');
		}
	}

	function updateDropdowns(modified_cids, state) {
		modified_cids.forEach(function (cid) {
			const category = $('[data-cid="' + cid + '"]');
			category.find('[component="category/watching/menu"]').toggleClass('hidden', state !== 'watching');
			category.find('[component="category/watching/check"]').toggleClass('fa-check', state === 'watching');

			category.find('[component="category/tracking/menu"]').toggleClass('hidden', state !== 'tracking');
			category.find('[component="category/tracking/check"]').toggleClass('fa-check', state === 'tracking');

			category.find('[component="category/notwatching/menu"]').toggleClass('hidden', state !== 'notwatching');
			category.find('[component="category/notwatching/check"]').toggleClass('fa-check', state === 'notwatching');

			category.find('[component="category/ignoring/menu"]').toggleClass('hidden', state !== 'ignoring');
			category.find('[component="category/ignoring/check"]').toggleClass('fa-check', state === 'ignoring');
		});
	}

	async function onNewPost({ posts }) {
		const feedEl = document.getElementById('world-feed');
		const html = await app.parseAndTranslate('world', 'posts', { posts });
		if (!feedEl || !html) {
			return;
		}

		feedEl.prepend(...html);
		handleImages();
		handleShowMoreButtons();
	}

	return World;
});
