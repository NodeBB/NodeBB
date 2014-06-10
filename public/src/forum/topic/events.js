
'use strict';

/* globals app, ajaxify, define, socket */

define('forum/topic/events', ['forum/topic/browsing', 'forum/topic/postTools', 'forum/topic/threadTools'], function(browsing, postTools, threadTools) {

	var Events = {};

	var events = {
		'event:update_users_in_room': browsing.onUpdateUsersInRoom,
		'user.isOnline': browsing.onUserOnline,
		'event:voted': updatePostVotesAndUserReputation,
		'event:favourited': updateFavouriteCount,

		'event:topic_deleted': toggleTopicDeleteState,
		'event:topic_restored': toggleTopicDeleteState,
		'event:topic_purged': onTopicPurged,

		'event:topic_locked': toggleTopicLockedState,
		'event:topic_unlocked': toggleTopicLockedState,

		'event:topic_pinned': toggleTopicPinnedState,
		'event:topic_unpinned': toggleTopicPinnedState,

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
		ajaxify.refresh();
	}

	function toggleTopicLockedState(data) {
		threadTools.setLockedState(data);

		app.alertSuccess(data.isLocked ? '[[topic:topic_lock_success]]' : '[[topic:topic_unlock_success]]');
	}

	function toggleTopicPinnedState(data) {
		threadTools.setPinnedState(data);

		app.alertSuccess(data.isPinned ? '[[topic:topic_pin_success]]' : '[[topic:topic_unpin_success]]');
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
				editedPostTitle.html(data.title);
				editedPostTitle.fadeIn(250);
			});
		}

		editedPostEl.fadeOut(250, function() {
			editedPostEl.html(data.content);
			editedPostEl.find('img').addClass('img-responsive');
			editedPostEl.fadeIn(250);
		});
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
				translator.translate('[[topic:post_is_deleted]]', function(translated) {
					postEl.find('.post-content').html(translated);
				});
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