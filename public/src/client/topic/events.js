
'use strict';


define('forum/topic/events', [
	'forum/topic/postTools',
	'forum/topic/threadTools',
	'forum/topic/posts',
	'forum/topic/images',
	'components',
	'translator',
	'hooks',
	'helpers',
], function (postTools, threadTools, posts, images, components, translator, hooks, helpers) {
	const Events = {};

	const events = {
		'event:user_status_change': onUserStatusChange,
		'event:voted': updatePostVotesAndUserReputation,
		'event:bookmarked': updateBookmarkCount,

		'event:topic_deleted': threadTools.setDeleteState,
		'event:topic_restored': threadTools.setDeleteState,
		'event:topic_purged': onTopicPurged,

		'event:topic_locked': threadTools.setLockedState,
		'event:topic_unlocked': threadTools.setLockedState,

		'event:topic_pinned': threadTools.setPinnedState,
		'event:topic_unpinned': threadTools.setPinnedState,

		'event:topic_moved': onTopicMoved,

		'event:post_edited': onPostEdited,
		'event:post_purged': onPostPurged,

		'event:post_deleted': togglePostDeleteState,
		'event:post_restored': togglePostDeleteState,

		'posts.bookmark': togglePostBookmark,
		'posts.unbookmark': togglePostBookmark,

		'posts.upvote': togglePostVote,
		'posts.downvote': togglePostVote,
		'posts.unvote': togglePostVote,

		'event:new_notification': onNewNotification,
		'event:new_post': posts.onNewPost,
	};

	Events.init = function () {
		Events.removeListeners();
		for (const [eventName, handler] of Object.entries(events)) {
			socket.on(eventName, handler);
		}
	};

	Events.removeListeners = function () {
		for (const [eventName, handler] of Object.entries(events)) {
			socket.removeListener(eventName, handler);
		}
	};

	function onUserStatusChange(data) {
		app.updateUserStatus($('[data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
	}

	function updatePostVotesAndUserReputation(data) {
		const votes = $('[data-pid="' + data.post.pid + '"] [component="post/vote-count"]').filter(function (index, el) {
			return $(el).closest('[data-pid]').attr('data-pid') === String(data.post.pid);
		});
		const reputationElements = $('.reputation[data-uid="' + data.post.uid + '"]');
		votes.html(data.post.votes).attr('data-votes', data.post.votes);
		reputationElements.html(data.user.reputation).attr('data-reputation', data.user.reputation);
	}

	function updateBookmarkCount(data) {
		$('[data-pid="' + data.post.pid + '"] .bookmarkCount').filter(function (index, el) {
			return $(el).closest('[data-pid]').attr('data-pid') === String(data.post.pid);
		}).html(data.post.bookmarks).attr('data-bookmarks', data.post.bookmarks);
	}

	function onTopicPurged(data) {
		if (
			ajaxify.data.category &&
			ajaxify.data.category.slug &&
			String(data.tid) === String(ajaxify.data.tid)
		) {
			ajaxify.go('category/' + ajaxify.data.category.slug, null, true);
		}
	}

	function onTopicMoved(data) {
		if (data && data.slug && String(data.tid) === String(ajaxify.data.tid)) {
			ajaxify.go('topic/' + data.slug, null, true);
		}
	}

	function onPostEdited(data) {
		if (!data || !data.post || String(data.post.tid) !== String(ajaxify.data.tid)) {
			return;
		}
		const editedPostEl = components.get('post/content', data.post.pid).filter(function (index, el) {
			return String($(el).closest('[data-pid]').attr('data-pid')) === String(data.post.pid);
		});
		const postContainer = $(`[data-pid="${data.post.pid}"]`);
		const editorEl = postContainer.find('[component="post/editor"]').filter(function (index, el) {
			return String($(el).closest('[data-pid]').attr('data-pid')) === String(data.post.pid);
		});
		const topicTitle = components.get('topic/title');
		const navbarTitle = components.get('navbar/title').find('span');
		const breadCrumb = components.get('breadcrumb/current');

		if (data.topic.rescheduled) {
			return ajaxify.go('topic/' + data.topic.slug, null, true);
		}

		if (topicTitle.length && data.topic.title && data.topic.renamed) {
			ajaxify.data.title = data.topic.title;
			const newUrl = 'topic/' + data.topic.slug + (window.location.search ? window.location.search : '');
			history.replaceState({ url: newUrl }, null, window.location.protocol + '//' + window.location.host + config.relative_path + '/' + newUrl);

			topicTitle.fadeOut(250, function () {
				topicTitle.html(data.topic.title).fadeIn(250);
			});
			breadCrumb.fadeOut(250, function () {
				breadCrumb.html(data.topic.title).fadeIn(250);
			});
			navbarTitle.fadeOut(250, function () {
				navbarTitle.html(data.topic.title).fadeIn(250);
			});
		}

		if (data.post.changed) {
			editedPostEl.fadeOut(250, function () {
				editedPostEl.html(translator.unescape(data.post.content));
				editedPostEl.find('img:not(.not-responsive)').addClass('img-fluid');
				images.wrapImagesInLinks(editedPostEl.parent());
				posts.addBlockquoteEllipses(editedPostEl.parent());
				editedPostEl.fadeIn(250);

				if (data.post.edited) {
					const editData = {
						editor: data.editor,
						editedISO: utils.toISOString(data.post.edited),
					};

					app.parseAndTranslate('partials/topic/post-editor', editData, function (html) {
						editorEl.replaceWith(html);
						postContainer.find('[component="post/edit-indicator"]')
							.removeClass('hidden')
							.translateAttr('title', `[[global:edited-timestamp, ${helpers.isoTimeToLocaleString(editData.editedISO, config.userLang)}]]`);
						postContainer.find('[component="post/editor"] .timeago').timeago();
						hooks.fire('action:posts.edited', data);
					});
				}
			});

			const parentEl = $(`[component="post/parent"][data-parent-pid="${data.post.pid}"]`);
			if (parentEl.length) {
				parentEl.find('[component="post/parent/content"]').html(
					translator.unescape(data.post.content)
				);
				parentEl.find('img:not(.not-responsive)').addClass('img-fluid');
				parentEl.find('[component="post/parent/content"] img:not(.emoji)').each(function () {
					images.wrapImageInLink($(this));
				});
			}
		} else {
			hooks.fire('action:posts.edited', data);
		}

		if (data.topic.tags && data.topic.tagsupdated) {
			require(['forum/topic/tag'], function (tag) {
				tag.updateTopicTags([data.topic]);
			});
		}

		if (data.topic.thumbsupdated) {
			require(['topicThumbs'], function (topicThumbs) {
				topicThumbs.updateTopicThumbs(data.topic.tid);
			});
		}

		postTools.removeMenu(components.get('post', 'pid', data.post.pid));
	}

	function onPostPurged(postData) {
		if (!postData || String(postData.tid) !== String(ajaxify.data.tid)) {
			return;
		}
		components.get('post', 'pid', postData.pid).fadeOut(500, function () {
			$(this).remove();
			posts.showBottomPostBar();
		});
		ajaxify.data.postcount -= 1;
		postTools.updatePostCount(ajaxify.data.postcount);
		require(['forum/topic/replies'], function (replies) {
			replies.onPostPurged(postData);
		});
		$(`[component="post/parent"][data-parent-pid="${postData.pid}"]`).remove();
	}

	function togglePostDeleteState(data) {
		const postEl = components.get('post', 'pid', data.pid);

		const { isAdminOrMod } = ajaxify.data.privileges;
		const isSelfPost = String(data.uid) === String(app.user.uid);
		const isDeleted = !!data.deleted;
		if (postEl.length) {
			postEl.toggleClass('deleted');
			postTools.toggle(data.pid, isDeleted);

			if (!isAdminOrMod && !isSelfPost) {
				postEl.find('[component="post/tools"]').toggleClass('hidden', isDeleted);
				if (isDeleted) {
					postEl.find('[component="post/content"]').translateHtml('[[topic:post-is-deleted]]');
				} else {
					postEl.find('[component="post/content"]').html(translator.unescape(data.content));
				}
			}
		}

		const parentEl = $(`[component="post/parent"][data-parent-pid="${data.pid}"]`);
		if (parentEl.length) {
			parentEl.each((i, el) => {
				const $parent = $(el);
				if (isDeleted) {
					$parent.find('[component="post/parent/content"]').translateHtml('[[topic:post-is-deleted]]');
				} else {
					$parent.find('[component="post/parent/content"]').html(translator.unescape(data.content));
				}
			});
		}
	}

	function togglePostBookmark(data) {
		const el = $('[data-pid="' + data.post.pid + '"] [component="post/bookmark"]').filter(function (index, el) {
			return $(el).closest('[data-pid]').attr('data-pid') === String(data.post.pid);
		});
		if (!el.length) {
			return;
		}

		el.attr('data-bookmarked', data.isBookmarked);

		el.find('[component="post/bookmark/on"]').toggleClass('hidden', !data.isBookmarked);
		el.find('[component="post/bookmark/off"]').toggleClass('hidden', data.isBookmarked);
	}

	function togglePostVote(data) {
		const post = $('[data-pid="' + data.post.pid + '"]');
		post.find('[component="post/upvote"]').filter(function (index, el) {
			return $(el).closest('[data-pid]').attr('data-pid') === String(data.post.pid);
		}).toggleClass('upvoted', data.upvote);
		post.find('[component="post/downvote"]').filter(function (index, el) {
			return $(el).closest('[data-pid]').attr('data-pid') === String(data.post.pid);
		}).toggleClass('downvoted', data.downvote);
	}

	function onNewNotification(data) {
		const tid = ajaxify.data.tid;
		if (data && data.tid && String(data.tid) === String(tid)) {
			socket.emit('topics.markTopicNotificationsRead', [tid]);
		}
	}

	return Events;
});
