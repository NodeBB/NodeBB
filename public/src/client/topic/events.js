
'use strict';


define('forum/topic/events', [
	'forum/topic/postTools',
	'forum/topic/threadTools',
	'forum/topic/posts',
	'forum/topic/images',
	'components',
	'translator',
	'benchpress',
], function (postTools, threadTools, posts, images, components, translator, Benchpress) {
	var Events = {};

	var events = {
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
		for (var eventName in events) {
			if (events.hasOwnProperty(eventName)) {
				socket.on(eventName, events[eventName]);
			}
		}
	};

	Events.removeListeners = function () {
		for (var eventName in events) {
			if (events.hasOwnProperty(eventName)) {
				socket.removeListener(eventName, events[eventName]);
			}
		}
	};

	function onUserStatusChange(data) {
		app.updateUserStatus($('[data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
	}

	function updatePostVotesAndUserReputation(data) {
		var votes = $('[data-pid="' + data.post.pid + '"] [component="post/vote-count"]').filter(function (index, el) {
			return parseInt($(el).closest('[data-pid]').attr('data-pid'), 10) === parseInt(data.post.pid, 10);
		});
		var reputationElements = $('.reputation[data-uid="' + data.post.uid + '"]');
		votes.html(data.post.votes).attr('data-votes', data.post.votes);
		reputationElements.html(data.user.reputation).attr('data-reputation', data.user.reputation);
	}

	function updateBookmarkCount(data) {
		$('[data-pid="' + data.post.pid + '"] .bookmarkCount').filter(function (index, el) {
			return parseInt($(el).closest('[data-pid]').attr('data-pid'), 10) === parseInt(data.post.pid, 10);
		}).html(data.post.bookmarks).attr('data-bookmarks', data.post.bookmarks);
	}

	function onTopicPurged() {
		if (ajaxify.data.category && ajaxify.data.category.slug) {
			ajaxify.go('category/' + ajaxify.data.category.slug, null, true);
		}
	}

	function onTopicMoved(data) {
		if (data && data.slug) {
			ajaxify.go('topic/' + data.slug, null, true);
		}
	}

	function onPostEdited(data) {
		if (!data || !data.post) {
			return;
		}
		var editedPostEl = components.get('post/content', data.post.pid).filter(function (index, el) {
			return parseInt($(el).closest('[data-pid]').attr('data-pid'), 10) === parseInt(data.post.pid, 10);
		});

		var editorEl = $('[data-pid="' + data.post.pid + '"] [component="post/editor"]').filter(function (index, el) {
			return parseInt($(el).closest('[data-pid]').attr('data-pid'), 10) === parseInt(data.post.pid, 10);
		});
		var topicTitle = components.get('topic/title');
		var navbarTitle = components.get('navbar/title').find('span');
		var breadCrumb = components.get('breadcrumb/current');

		if (topicTitle.length && data.topic.title && topicTitle.html() !== data.topic.title) {
			ajaxify.data.title = data.topic.title;
			var newUrl = 'topic/' + data.topic.slug + (window.location.search ? window.location.search : '');
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

		editedPostEl.fadeOut(250, function () {
			editedPostEl.html(translator.unescape(data.post.content));
			editedPostEl.find('img:not(.not-responsive)').addClass('img-responsive');
			app.replaceSelfLinks(editedPostEl.find('a'));
			images.wrapImagesInLinks(editedPostEl.parent());
			images.unloadImages(editedPostEl.parent());
			images.loadImages();
			editedPostEl.fadeIn(250);

			var editData = {
				editor: data.editor,
				editedISO: utils.toISOString(data.post.edited),
			};

			Benchpress.parse('partials/topic/post-editor', editData, function (html) {
				translator.translate(html, function (translated) {
					html = $(translated);
					editorEl.replaceWith(html);
					$('[data-pid="' + data.post.pid + '"] [component="post/editor"] .timeago').timeago();
					$(window).trigger('action:posts.edited', data);
				});
			});
		});

		if (data.topic.tags && tagsUpdated(data.topic.tags)) {
			Benchpress.parse('partials/post_bar', 'tags', { tags: data.topic.tags }, function (html) {
				var tags = $('.tags');

				tags.fadeOut(250, function () {
					tags.html(html).fadeIn(250);
				});
			});
		}

		postTools.removeMenu(components.get('post', 'pid', data.post.pid));
	}

	function tagsUpdated(tags) {
		if (tags.length !== $('.tags').first().children().length) {
			return true;
		}

		for (var i = 0; i < tags.length; i += 1) {
			if (!$('.tags .tag-item[data-tag="' + tags[i].value + '"]').length) {
				return true;
			}
		}
		return false;
	}

	function onPostPurged(postData) {
		components.get('post', 'pid', postData.pid).fadeOut(500, function () {
			$(this).remove();
			posts.showBottomPostBar();
		});
		ajaxify.data.postcount -= 1;
		postTools.updatePostCount(ajaxify.data.postcount);
		require(['forum/topic/replies'], function (replies) {
			replies.onPostPurged(postData);
		});
	}

	function togglePostDeleteState(data) {
		var postEl = components.get('post', 'pid', data.pid);

		if (!postEl.length) {
			return;
		}

		postEl.toggleClass('deleted');
		var isDeleted = postEl.hasClass('deleted');
		postTools.toggle(data.pid, isDeleted);

		if (!ajaxify.data.privileges.isAdminOrMod && parseInt(data.uid, 10) !== parseInt(app.user.uid, 10)) {
			postEl.find('[component="post/tools"]').toggleClass('hidden', isDeleted);
			if (isDeleted) {
				postEl.find('[component="post/content"]').translateHtml('[[topic:post_is_deleted]]');
			} else {
				postEl.find('[component="post/content"]').html(translator.unescape(data.content));
			}
		}
	}

	function togglePostBookmark(data) {
		var el = $('[data-pid="' + data.post.pid + '"] [component="post/bookmark"]').filter(function (index, el) {
			return parseInt($(el).closest('[data-pid]').attr('data-pid'), 10) === parseInt(data.post.pid, 10);
		});
		if (!el.length) {
			return;
		}

		el.attr('data-bookmarked', data.isBookmarked);

		el.find('[component="post/bookmark/on"]').toggleClass('hidden', !data.isBookmarked);
		el.find('[component="post/bookmark/off"]').toggleClass('hidden', data.isBookmarked);
	}

	function togglePostVote(data) {
		var post = $('[data-pid="' + data.post.pid + '"]');
		post.find('[component="post/upvote"]').filter(function (index, el) {
			return parseInt($(el).closest('[data-pid]').attr('data-pid'), 10) === parseInt(data.post.pid, 10);
		}).toggleClass('upvoted', data.upvote);
		post.find('[component="post/downvote"]').filter(function (index, el) {
			return parseInt($(el).closest('[data-pid]').attr('data-pid'), 10) === parseInt(data.post.pid, 10);
		}).toggleClass('downvoted', data.downvote);
	}

	function onNewNotification(data) {
		var tid = ajaxify.data.tid;
		if (data && data.tid && parseInt(data.tid, 10) === parseInt(tid, 10)) {
			socket.emit('topics.markTopicNotificationsRead', [tid]);
		}
	}

	return Events;
});
