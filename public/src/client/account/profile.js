'use strict';

/* globals define, ajaxify, app, utils, socket */

define('forum/account/profile', ['forum/account/header', 'forum/infinitescroll', 'translator'], function(header, infinitescroll, translator) {
	var Account = {},
		yourid,
		theirid,
		isFollowing;

	Account.init = function() {
		header.init();

		yourid = ajaxify.variables.get('yourid');
		theirid = ajaxify.variables.get('theirid');
		isFollowing = ajaxify.variables.get('isFollowing');

		app.enterRoom('user/' + theirid);

		processPage();

		updateButtons();

		$('#follow-btn').on('click', function() {
			return toggleFollow('follow');
		});

		$('#unfollow-btn').on('click', function() {
			return toggleFollow('unfollow');
		});

		$('#chat-btn').on('click', function() {
			app.openChat($('.account-username').html(), theirid);
		});

		socket.removeListener('event:user_status_change', onUserStatusChange);
		socket.on('event:user_status_change', onUserStatusChange);

		infinitescroll.init(loadMorePosts);
	};

	function processPage() {
		$('[component="posts"] img, [component="aboutme"] img').addClass('img-responsive');
	}

	function updateButtons() {
		var isSelfOrNotLoggedIn = yourid === theirid || parseInt(yourid, 10) === 0;
		$('#follow-btn').toggleClass('hide', isFollowing || isSelfOrNotLoggedIn);
		$('#unfollow-btn').toggleClass('hide', !isFollowing || isSelfOrNotLoggedIn);
		$('#chat-btn').toggleClass('hide', isSelfOrNotLoggedIn);
	}

	function toggleFollow(type) {
		socket.emit('user.' + type, {
			uid: theirid
		}, function(err) {
			if (err) {
				return app.alertError(err.message);
			}

			$('#follow-btn').toggleClass('hide', type === 'follow');
			$('#unfollow-btn').toggleClass('hide', type === 'unfollow');
			app.alertSuccess('[[global:alert.' + type + ', ' + $('.account-username').html() + ']]');
		});
		return false;
	}

	function onUserStatusChange(data) {
		if (parseInt(ajaxify.variables.get('theirid'), 10) !== parseInt(data.uid, 10)) {
			return;
		}

		app.updateUserStatus($('.account [component="user/status"]'), data.status);
	}

	function loadMorePosts(direction) {
		if (direction < 0 || !$('[component="posts"]').length) {
			return;
		}

		$('[component="posts/loading"]').removeClass('hidden');

		infinitescroll.loadMore('posts.loadMoreUserPosts', {
			after: $('[component="posts"]').attr('data-nextstart'),
			uid: theirid
		}, function(data, done) {
			if (data.posts && data.posts.length) {
				onPostsLoaded(data.posts, done);
			} else {
				done();
			}
			$('[component="posts"]').attr('data-nextstart', data.nextStart);
			$('[component="posts/loading"]').addClass('hidden');
		});
	}

	function onPostsLoaded(posts, callback) {
		posts = posts.filter(function(post) {
			return !$('[component="posts"] [data-pid=' + post.pid + ']').length;
		});

		if (!posts.length) {
			return callback();
		}

		infinitescroll.parseAndTranslate('account/profile', 'posts', {posts: posts}, function(html) {

			$('[component="posts"]').append(html);
			html.find('.timeago').timeago();

			callback();
		});
	}

	return Account;
});
