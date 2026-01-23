'use strict';

define('forum/world', [
	'forum/infinitescroll', 'search', 'sort', 'hooks',
	'alerts', 'api', 'bootbox', 'helpers', 'forum/category/tools',
], function (infinitescroll, search, sort, hooks, alerts, api, bootbox, helpers, categoryTools) {
	const World = {};

	$(window).on('action:ajaxify.start', function () {
		categoryTools.removeListeners();
	});

	World.init = function () {
		app.enterRoom('world');
		categoryTools.init($('#world-feed'));

		sort.handleSort('categoryTopicSort', 'world');

		handleButtons();
		handleHelp();

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
				const posts = Array.from(document.querySelectorAll('[component="post"]'));
				const afterEl = direction > 0 ? posts.pop() : posts.shift();
				const after = (parseInt(afterEl.getAttribute('data-index'), 10) || 0) + (direction > 0 ? 1 : 0);
				if (after < config.topicsPerPage) {
					return;
				}

				loadTopicsAfter(after, direction, (payload) => {
					app.parseAndTranslate(ajaxify.data.template.name, 'posts', payload, function (html) {
						const listEl = document.getElementById('world-feed');
						$(listEl).append(html);
						html.find('.timeago').timeago();
					});
				});
			});
		}

		hooks.fire('action:topics.loaded', { topics: ajaxify.data.topics });
		hooks.fire('action:category.loaded', { cid: ajaxify.data.cid });
	};

	function calculateNextPage(after, direction) {
		return Math.floor(after / config.topicsPerPage) + (direction > 0 ? 1 : 0);
	}

	function loadTopicsAfter(after, direction, callback) {
		callback = callback || function () {};
		const query = utils.params();
		query.page = calculateNextPage(after, direction);
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

	return World;
});
