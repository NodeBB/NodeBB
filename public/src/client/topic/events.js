
'use strict';

/* globals config, app, ajaxify, define, socket, templates, utils */

define('forum/topic/events', [
	'forum/topic/postTools',
	'forum/topic/threadTools',
	'forum/topic/posts',
	'components',
	'translator'
], function(postTools, threadTools, posts, components, translator) {

	var Events = {};

	var events = {
		'event:user_status_change': onUserStatusChange,
		'event:voted': updatePostVotesAndUserReputation,
		'event:favourited': updateFavouriteCount,

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

		'posts.favourite': togglePostFavourite,
		'posts.unfavourite': togglePostFavourite,

		'posts.upvote': togglePostVote,
		'posts.downvote': togglePostVote,
		'posts.unvote': togglePostVote,

		'event:new_notification': onNewNotification,
		'event:new_post': posts.onNewPost
	};

	Events.init = function() {
		Events.removeListeners();
		for(var eventName in events) {
			if (events.hasOwnProperty(eventName)) {
				socket.on(eventName, events[eventName]);
			}
		}
	};

	Events.removeListeners = function() {
		for(var eventName in events) {
			if (events.hasOwnProperty(eventName)) {
				socket.removeListener(eventName, events[eventName]);
			}
		}
	};

	function onUserStatusChange(data) {
		app.updateUserStatus($('[data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
	}

	function updatePostVotesAndUserReputation(data) {
		var votes = components.get('post/vote-count', data.post.pid),
			reputationElements = $('.reputation[data-uid="' + data.post.uid + '"]');

		votes.html(data.post.votes).attr('data-votes', data.post.votes);
		reputationElements.html(data.user.reputation).attr('data-reputation', data.user.reputation);
	}

	function updateFavouriteCount(data) {
		$('[data-pid="' + data.post.pid + '"] .favouriteCount').html(data.post.reputation).attr('data-favourites', data.post.reputation);
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
		var editedPostEl = components.get('post/content', data.post.pid),
			editorEl = $('[data-pid="' + data.post.pid + '"] [component="post/editor"]'),
			topicTitle = components.get('topic/title'),
			breadCrumb = components.get('breadcrumb/current');

		if (topicTitle.length && data.topic.title && topicTitle.html() !== data.topic.title) {
			var newUrl = 'topic/' + data.topic.slug + (window.location.search ? window.location.search : '');
			history.replaceState({url: newUrl}, null, window.location.protocol + '//' + window.location.host + config.relative_path + '/' + newUrl);

			topicTitle.fadeOut(250, function() {
				topicTitle.html(data.topic.title).fadeIn(250);
			});
			breadCrumb.fadeOut(250, function() {
				breadCrumb.html(data.topic.title).fadeIn(250);
			});
		}

		editedPostEl.fadeOut(250, function() {
			editedPostEl.html(translator.unescape(data.post.content));
			editedPostEl.find('img:not(.not-responsive)').addClass('img-responsive');
			app.replaceSelfLinks(editedPostEl.find('a'));
			posts.wrapImagesInLinks(editedPostEl.parent());
			posts.unloadImages(editedPostEl.parent());
			posts.loadImages();
			editedPostEl.fadeIn(250);
			$(window).trigger('action:posts.edited', data);
		});

		var editData = {
			editor: data.editor,
			editedISO: utils.toISOString(data.post.edited)
		};

		templates.parse('partials/topic/post-editor', editData, function(html) {
			translator.translate(html, function(translated) {
				html = $(translated);
				editorEl.replaceWith(html);
				html.find('.timeago').timeago();
			});
		});

		if (data.topic.tags && tagsUpdated(data.topic.tags)) {
			templates.parse('partials/post_bar', 'tags', {tags: data.topic.tags}, function(html) {
				var tags = $('.tags');

				tags.fadeOut(250, function() {
					tags.html(html).fadeIn(250);
				});
			});
		}
	}

	function tagsUpdated(tags) {
		if (tags.length !== $('.tags').first().children().length) {
			return true;
		}

		for (var i=0; i<tags.length; ++i) {
			if (!$('.tags .tag-item[data-tag="' + tags[i].value + '"]').length) {
				return true;
			}
		}
		return false;
	}

	function onPostPurged(pid) {
		components.get('post', 'pid', pid).fadeOut(500, function() {
			$(this).remove();
			ajaxify.data.postcount --;
			postTools.updatePostCount(ajaxify.data.postcount);
			posts.showBottomPostBar();
		});

		postTools.updatePostCount();
	}

	function togglePostDeleteState(data) {
		var postEl = components.get('post', 'pid', data.pid);

		if (!postEl.length) {
			return;
		}

		postEl.toggleClass('deleted');
		var isDeleted = postEl.hasClass('deleted');
		postTools.toggle(data.pid, isDeleted);

		if (!app.user.isAdmin && !app.user.isGlobalMod && parseInt(data.uid, 10) !== parseInt(app.user.uid, 10)) {
			postEl.find('[component="post/tools"]').toggleClass('hidden', isDeleted);
			if (isDeleted) {
				postEl.find('[component="post/content"]').translateHtml('[[topic:post_is_deleted]]');
			} else {
				postEl.find('[component="post/content"]').html(translator.unescape(data.content));
			}
		}
	}

	function togglePostFavourite(data) {
		var favBtn = $('[data-pid="' + data.post.pid + '"] [component="post/favourite"]');

		if (!favBtn.length) {
			return;
		}

		favBtn.attr('data-favourited', data.isFavourited);

		favBtn.find('[component="post/favourite/on"]').toggleClass('hidden', !data.isFavourited);
		favBtn.find('[component="post/favourite/off"]').toggleClass('hidden', data.isFavourited);
	}

	function togglePostVote(data) {
		var post = $('[data-pid="' + data.post.pid + '"]');
		post.find('[component="post/upvote"]').toggleClass('upvoted', data.upvote);
		post.find('[component="post/downvote"]').toggleClass('downvoted', data.downvote);
	}

	function onNewNotification(data) {
		var tid = ajaxify.data.tid;
		if (data && data.tid && parseInt(data.tid, 10) === parseInt(tid, 10)) {
			socket.emit('topics.markTopicNotificationsRead', tid);
		}
	}

	return Events;
});
