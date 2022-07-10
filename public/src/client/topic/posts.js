'use strict';


define('forum/topic/posts', [
	'forum/pagination',
	'forum/infinitescroll',
	'forum/topic/postTools',
	'forum/topic/images',
	'navigator',
	'components',
	'translator',
	'hooks',
	'helpers',
], function (pagination, infinitescroll, postTools, images, navigator, components, translator, hooks, helpers) {
	const Posts = { };

	Posts.onNewPost = function (data) {
		if (
			!data ||
			!data.posts ||
			!data.posts.length ||
			parseInt(data.posts[0].tid, 10) !== parseInt(ajaxify.data.tid, 10)
		) {
			return;
		}

		data.loggedIn = !!app.user.uid;
		data.privileges = ajaxify.data.privileges;

		// if not a scheduled topic, prevent timeago in future by setting timestamp to 1 sec behind now
		data.posts[0].timestamp = data.posts[0].topic.scheduled ? data.posts[0].timestamp : Date.now() - 1000;
		data.posts[0].timestampISO = utils.toISOString(data.posts[0].timestamp);

		Posts.modifyPostsByPrivileges(data.posts);

		updatePostCounts(data.posts);

		updatePostIndices(data.posts);

		ajaxify.data.postcount += 1;
		postTools.updatePostCount(ajaxify.data.postcount);

		if (config.usePagination) {
			onNewPostPagination(data);
		} else {
			onNewPostInfiniteScroll(data);
		}

		require(['forum/topic/replies'], function (replies) {
			replies.onNewPost(data);
		});
	};

	Posts.modifyPostsByPrivileges = function (posts) {
		posts.forEach(function (post) {
			post.selfPost = !!app.user.uid && parseInt(post.uid, 10) === parseInt(app.user.uid, 10);
			post.topicOwnerPost = parseInt(post.uid, 10) === parseInt(ajaxify.data.uid, 10);

			post.display_edit_tools = (ajaxify.data.privileges['posts:edit'] && post.selfPost) || ajaxify.data.privileges.isAdminOrMod;
			post.display_delete_tools = (ajaxify.data.privileges['posts:delete'] && post.selfPost) || ajaxify.data.privileges.isAdminOrMod;
			post.display_moderator_tools = post.display_edit_tools || post.display_delete_tools;
			post.display_move_tools = ajaxify.data.privileges.isAdminOrMod;
			post.display_post_menu = ajaxify.data.privileges.isAdminOrMod ||
				(post.selfPost && !ajaxify.data.locked && !post.deleted) ||
				(post.selfPost && post.deleted && parseInt(post.deleterUid, 10) === parseInt(app.user.uid, 10)) ||
				((app.user.uid || ajaxify.data.postSharing.length) && !post.deleted);
		});
	};

	function updatePostCounts(posts) {
		for (let i = 0; i < posts.length; i += 1) {
			const cmp = components.get('user/postcount', posts[i].uid);
			cmp.html(parseInt(cmp.attr('data-postcount'), 10) + 1);
			utils.addCommasToNumbers(cmp);
		}
	}

	function updatePostIndices(posts) {
		if (config.topicPostSort === 'newest_to_oldest') {
			posts[0].index = 1;
			components.get('post').not('[data-index=0]').each(function () {
				const newIndex = parseInt($(this).attr('data-index'), 10) + 1;
				$(this).attr('data-index', newIndex);
			});
		}
	}

	function onNewPostPagination(data) {
		function scrollToPost() {
			scrollToPostIfSelf(data.posts[0]);
		}

		const posts = data.posts;

		ajaxify.data.pagination.pageCount = Math.max(1, Math.ceil(posts[0].topic.postcount / config.postsPerPage));
		const direction = config.topicPostSort === 'oldest_to_newest' || config.topicPostSort === 'most_votes' ? 1 : -1;

		const isPostVisible = (
			ajaxify.data.pagination.currentPage === ajaxify.data.pagination.pageCount &&
			direction === 1
		) || (ajaxify.data.pagination.currentPage === 1 && direction === -1);

		if (isPostVisible) {
			const repliesSelector = $('[component="post"]:not([data-index=0]), [component="topic/event"]');
			createNewPosts(data, repliesSelector, direction, false, scrollToPost);
		} else if (ajaxify.data.scrollToMyPost && parseInt(posts[0].uid, 10) === parseInt(app.user.uid, 10)) {
			// https://github.com/NodeBB/NodeBB/issues/5004#issuecomment-247157441
			setTimeout(function () {
				pagination.loadPage(ajaxify.data.pagination.pageCount, scrollToPost);
			}, 250);
		} else {
			updatePagination();
		}
	}

	function updatePagination() {
		$.get(config.relative_path + '/api/topic/pagination/' + ajaxify.data.tid, { page: ajaxify.data.pagination.currentPage }, function (paginationData) {
			app.parseAndTranslate('partials/paginator', paginationData, function (html) {
				$('[component="pagination"]').after(html).remove();
			});
		});
	}

	function onNewPostInfiniteScroll(data) {
		const direction = (config.topicPostSort === 'oldest_to_newest' || config.topicPostSort === 'most_votes') ? 1 : -1;

		const isPreviousPostAdded = $('[component="post"][data-index="' + (data.posts[0].index - 1) + '"]').length;
		if (!isPreviousPostAdded && (!data.posts[0].selfPost || !ajaxify.data.scrollToMyPost)) {
			return;
		}

		if (!isPreviousPostAdded && data.posts[0].selfPost) {
			return ajaxify.go('post/' + data.posts[0].pid);
		}
		const repliesSelector = $('[component="topic"]>[component="post"]:not([data-index=0]), [component="topic"]>[component="topic/event"]');
		createNewPosts(data, repliesSelector, direction, false, function (html) {
			if (html) {
				html.addClass('new');
			}
			scrollToPostIfSelf(data.posts[0]);
		});
	}

	function scrollToPostIfSelf(post) {
		if (post.selfPost && ajaxify.data.scrollToMyPost) {
			navigator.scrollBottom(post.index);
		}
	}

	function createNewPosts(data, repliesSelector, direction, userScrolled, callback) {
		callback = callback || function () {};
		if (!data || (data.posts && !data.posts.length)) {
			return callback();
		}

		function removeAlreadyAddedPosts() {
			const newPosts = $('[component="post"].new');

			if (newPosts.length === data.posts.length) {
				let allSamePids = true;
				newPosts.each(function (index, el) {
					if (parseInt($(el).attr('data-pid'), 10) !== parseInt(data.posts[index].pid, 10)) {
						allSamePids = false;
					}
				});

				if (allSamePids) {
					newPosts.each(function () {
						$(this).removeClass('new');
					});
					data.posts.length = 0;
					return;
				}
			}

			if (newPosts.length && data.posts.length > 1) {
				data.posts.forEach(function (post) {
					const p = components.get('post', 'pid', post.pid);
					if (p.hasClass('new')) {
						p.remove();
					}
				});
			}

			data.posts = data.posts.filter(function (post) {
				return post.index === -1 || $('[component="post"][data-pid="' + post.pid + '"]').length === 0;
			});
		}

		removeAlreadyAddedPosts();

		if (!data.posts.length) {
			return callback();
		}

		let after;
		let before;

		if (direction > 0 && repliesSelector.length) {
			after = repliesSelector.last();
		} else if (direction < 0 && repliesSelector.length) {
			before = repliesSelector.first();
		}

		hooks.fire('action:posts.loading', { posts: data.posts, after: after, before: before });

		app.parseAndTranslate('topic', 'posts', Object.assign({}, ajaxify.data, data), function (html) {
			html = html.filter(function () {
				const $this = $(this);
				const pid = $this.attr('data-pid');
				const index = parseInt($this.attr('data-index'), 10);
				const isPost = $this.is('[component="post"]');
				return !isPost || index === -1 || (pid && $('[component="post"][data-pid="' + pid + '"]').length === 0);
			});

			if (after) {
				html.insertAfter(after);
			} else if (before) {
				// Save document height and position for future reference (about 5 lines down)
				const height = $(document).height();
				const scrollTop = $(window).scrollTop();

				html.insertBefore(before);

				// Now restore the relative position the user was on prior to new post insertion
				if (userScrolled || scrollTop > 0) {
					$(window).scrollTop(scrollTop + ($(document).height() - height));
				}
			} else {
				components.get('topic').append(html);
			}

			const removedEls = infinitescroll.removeExtra($('[component="post"]'), direction, Math.max(20, config.postsPerPage * 2));
			removeNecroPostMessages(removedEls);

			hooks.fire('action:posts.loaded', { posts: data.posts });

			Posts.onNewPostsAddedToDom(html);

			callback(html);
		});
	}

	Posts.loadMorePosts = function (direction) {
		if (!components.get('topic').length || navigator.scrollActive) {
			return;
		}

		const replies = components.get('topic').find(components.get('post').not('[data-index=0]').not('.new'));
		const afterEl = direction > 0 ? replies.last() : replies.first();
		const after = parseInt(afterEl.attr('data-index'), 10) || 0;

		const tid = ajaxify.data.tid;
		if (!utils.isNumber(tid) || !utils.isNumber(after) || (direction < 0 && components.get('post', 'index', 0).length)) {
			return;
		}

		const indicatorEl = $('.loading-indicator');
		if (!indicatorEl.is(':animated')) {
			indicatorEl.fadeIn();
		}

		infinitescroll.loadMore('topics.loadMore', {
			tid: tid,
			after: after + (direction > 0 ? 1 : 0),
			count: config.postsPerPage,
			direction: direction,
			topicPostSort: config.topicPostSort,
		}, function (data, done) {
			indicatorEl.fadeOut();

			if (data && data.posts && data.posts.length) {
				const repliesSelector = $('[component="post"]:not([data-index=0]):not(.new), [component="topic/event"]');
				createNewPosts(data, repliesSelector, direction, true, done);
			} else {
				navigator.update();
				done();
			}
		});
	};

	Posts.onTopicPageLoad = function (posts) {
		handlePrivateUploads(posts);
		images.wrapImagesInLinks(posts);
		Posts.showBottomPostBar();
		posts.find('[component="post/content"] img:not(.not-responsive)').addClass('img-responsive');
		Posts.addBlockquoteEllipses(posts);
		hidePostToolsForDeletedPosts(posts);
		addNecroPostMessage();
	};

	Posts.addTopicEvents = function (events) {
		if (config.topicPostSort === 'most_votes') {
			return;
		}
		const html = helpers.renderEvents.call(ajaxify.data, events);
		translator.translate(html, (translated) => {
			if (config.topicPostSort === 'oldest_to_newest') {
				$('[component="topic"]').append(translated);
			} else if (config.topicPostSort === 'newest_to_oldest') {
				const mainPost = $('[component="topic"] [component="post"][data-index="0"]');
				if (mainPost.length) {
					$(translated).insertAfter(mainPost);
				} else {
					$('[component="topic"]').prepend(translated);
				}
			}

			$('[component="topic/event"] .timeago').timeago();
		});
	};

	function addNecroPostMessage() {
		const necroThreshold = ajaxify.data.necroThreshold * 24 * 60 * 60 * 1000;
		if (!necroThreshold || (config.topicPostSort !== 'newest_to_oldest' && config.topicPostSort !== 'oldest_to_newest')) {
			return;
		}

		const postEls = $('[component="post"]').toArray();
		postEls.forEach(function (post) {
			post = $(post);
			const prev = post.prev('[component="post"]');
			if (post.is(':has(.necro-post)') || !prev.length) {
				return;
			}
			if (config.topicPostSort === 'newest_to_oldest' && parseInt(prev.attr('data-index'), 10) === 0) {
				return;
			}

			const diff = post.attr('data-timestamp') - prev.attr('data-timestamp');
			if (Math.abs(diff) >= necroThreshold) {
				const suffixAgo = $.timeago.settings.strings.suffixAgo;
				const prefixAgo = $.timeago.settings.strings.prefixAgo;
				const suffixFromNow = $.timeago.settings.strings.suffixFromNow;
				const prefixFromNow = $.timeago.settings.strings.prefixFromNow;

				$.timeago.settings.strings.suffixAgo = '';
				$.timeago.settings.strings.prefixAgo = '';
				$.timeago.settings.strings.suffixFromNow = '';
				$.timeago.settings.strings.prefixFromNow = '';

				const translationText = (diff > 0 ? '[[topic:timeago_later,' : '[[topic:timeago_earlier,') + $.timeago.inWords(diff) + ']]';

				$.timeago.settings.strings.suffixAgo = suffixAgo;
				$.timeago.settings.strings.prefixAgo = prefixAgo;
				$.timeago.settings.strings.suffixFromNow = suffixFromNow;
				$.timeago.settings.strings.prefixFromNow = prefixFromNow;
				app.parseAndTranslate('partials/topic/necro-post', { text: translationText }, function (html) {
					html.attr('data-necro-post-index', prev.attr('data-index'));
					html.insertBefore(post);
				});
			}
		});
	}

	function removeNecroPostMessages(removedPostEls) {
		removedPostEls.each((index, el) => {
			$(`[data-necro-post-index="${$(el).attr('data-index')}"]`).remove();
		});
	}

	function handlePrivateUploads(posts) {
		if (app.user.uid || !ajaxify.data.privateUploads) {
			return;
		}

		// Replace all requests for uploaded images/files with a login link
		const loginEl = document.createElement('a');
		loginEl.className = 'login-required';
		loginEl.href = config.relative_path + '/login';

		translator.translate('[[topic:login-to-view]]', function (translated) {
			loginEl.appendChild(document.createTextNode(translated));
			posts.each(function (idx, postEl) {
				$(postEl).find('[component="post/content"] img').each(function (idx, imgEl) {
					imgEl = $(imgEl);
					if (imgEl.attr('src').startsWith(config.relative_path + config.upload_url)) {
						imgEl.replaceWith(loginEl.cloneNode(true));
					}
				});
			});
		});
	}

	Posts.onNewPostsAddedToDom = function (posts) {
		Posts.onTopicPageLoad(posts);

		app.createUserTooltips(posts);

		utils.addCommasToNumbers(posts.find('.formatted-number'));
		utils.makeNumbersHumanReadable(posts.find('.human-readable-number'));
		posts.find('.timeago').timeago();
	};

	Posts.showBottomPostBar = function () {
		const mainPost = components.get('post', 'index', 0);
		const placeHolder = $('.post-bar-placeholder');
		const posts = $('[component="post"]');
		if (!!mainPost.length && posts.length > 1 && $('.post-bar').length < 2 && placeHolder.length) {
			$('.post-bar').clone().insertAfter(placeHolder);
			placeHolder.remove();
		} else if (mainPost.length && posts.length < 2) {
			mainPost.find('.post-bar').remove();
		}
	};

	function hidePostToolsForDeletedPosts(posts) {
		posts.each(function () {
			if ($(this).hasClass('deleted')) {
				postTools.toggle($(this).attr('data-pid'), true);
			}
		});
	}

	Posts.addBlockquoteEllipses = function (posts) {
		const blockquotes = posts.find('[component="post/content"] > blockquote > blockquote');
		blockquotes.each(function () {
			const $this = $(this);
			if ($this.find(':hidden:not(br)').length && !$this.find('.toggle').length) {
				$this.append('<i class="fa fa-angle-down pointer toggle"></i>');
			}
		});
	};

	return Posts;
});
