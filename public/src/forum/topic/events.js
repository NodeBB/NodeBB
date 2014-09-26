
'use strict';

/* globals app, ajaxify, define, socket, translator, templates */

define('forum/topic/events', ['forum/topic/browsing', 'forum/topic/postTools', 'forum/topic/threadTools'], function(browsing, postTools, threadTools) {

	var Events = {};

	var events = {
		'event:update_users_in_room': browsing.onUpdateUsersInRoom,
		'event:user_enter': browsing.onUserEnter,
		'event:user_leave': browsing.onUserLeave,
		'event:user_status_change': browsing.onUserStatusChange,
		'event:voted': updatePostVotesAndUserReputation,
		'event:favourited': updateFavouriteCount,

		'event:topic_deleted': toggleTopicDeleteState,
		'event:topic_restored': toggleTopicDeleteState,
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

		'event:topic.toggleReply': toggleReply,
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

	function updatePostVotesAndUserReputation(data) {
		var votes = $('li[data-pid="' + data.post.pid + '"] .votes'),
			reputationElements = $('.reputation[data-uid="' + data.post.uid + '"]');

		votes.html(data.post.votes).attr('data-votes', data.post.votes);
		reputationElements.html(data.user.reputation).attr('data-reputation', data.user.reputation);
	}

	function updateFavouriteCount(data) {
		$('li[data-pid="' + data.post.pid + '"] .favouriteCount').html(data.post.reputation).attr('data-favourites', data.post.reputation);
	}

	function toggleTopicDeleteState(data) {
		threadTools.setLockedState(data);
		threadTools.setDeleteState(data);
	}

	function onTopicPurged(tid) {
		ajaxify.go('category/' + ajaxify.variables.get('category_id'));
	}

	function onTopicMoved(data) {
		if (data && data.tid > 0) {
			ajaxify.go('topic/' + data.tid);
		}
	}

	function onPostEdited(data) {
		var editedPostEl = $('#content_' + data.pid),
			editedPostTitle = $('#topic_title_' + data.pid);

		if (editedPostTitle.length) {
			editedPostTitle.fadeOut(250, function() {
				editedPostTitle.html(data.title).fadeIn(250);
			});
		}

		editedPostEl.fadeOut(250, function() {
			editedPostEl.html(data.content);
			editedPostEl.find('img').addClass('img-responsive');
			app.replaceSelfLinks(editedPostEl.find('a'));
			editedPostEl.fadeIn(250);

			$(window).trigger('action:posts.edited');
		});

		if (data.tags && data.tags.length !== $('.tags').first().children().length) {
			ajaxify.loadTemplate('partials/post_bar', function(postBarTemplate) {
				var html = templates.parse(templates.getBlock(postBarTemplate, 'tags'), {
					tags: data.tags
				});
				var tags = $('.tags');
				tags.fadeOut(250, function() {
					tags.html(html).fadeIn(250);
				});
			});
		}
	}

	function onPostPurged(pid) {
		$('#post-container li[data-pid="' + pid + '"]').fadeOut(500, function() {
			$(this).remove();
		});
	}

	function togglePostDeleteState(data) {
		var postEl = $('#post-container li[data-pid="' + data.pid + '"]');

		if (!postEl.length) {
			return;
		}

		postEl.toggleClass('deleted');
		var isDeleted = postEl.hasClass('deleted');
		postTools.toggle(data.pid, isDeleted);

		if (!app.isAdmin && parseInt(data.uid, 10) !== parseInt(app.uid, 10)) {
			if (isDeleted) {
				postEl.find('.post-content').translateHtml('[[topic:post_is_deleted]]');
			} else {
				postEl.find('.post-content').html(data.content);
			}
		}

		postTools.updatePostCount();
	}

	function togglePostFavourite(data) {
		var favBtn = $('li[data-pid="' + data.post.pid + '"] .favourite');
		if (!favBtn.length) {
			return;
		}

		favBtn.addClass('btn-warning')
			.attr('data-favourited', data.isFavourited);

		var icon = favBtn.find('i');
		var className = icon.attr('class');

		if (data.isFavourited ? className.indexOf('-o') !== -1 : className.indexOf('-o') === -1) {
			icon.attr('class', data.isFavourited ? className.replace('-o', '') : className + '-o');
		}
	}

	function togglePostVote(data) {
		var post = $('li[data-pid="' + data.post.pid + '"]');

		post.find('.upvote').toggleClass('btn-primary upvoted', data.upvote);
		post.find('.downvote').toggleClass('btn-primary downvoted', data.downvote);
	}

	function toggleReply(data) {
		$('.thread_active_users [data-uid="' + data.uid + '"]').toggleClass('replying', data.isReplying);
	}

	return Events;

});
