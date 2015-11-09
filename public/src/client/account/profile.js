'use strict';

/* globals define, ajaxify, app, socket, bootbox */

define('forum/account/profile', [
	'forum/account/header',
	'forum/infinitescroll',
	'translator',
	'components'
], function(header, infinitescroll, translator) {
	var Account = {},
		yourid,
		theirid,
		isFollowing;

	Account.init = function() {
		header.init();

		yourid = ajaxify.data.yourid;
		theirid = ajaxify.data.theirid;
		isFollowing = ajaxify.data.isFollowing;

		app.enterRoom('user/' + theirid);

		processPage();
		updateButtons();

		socket.removeListener('event:user_status_change', onUserStatusChange);
		socket.on('event:user_status_change', onUserStatusChange);

		infinitescroll.init(loadMorePosts);
	};

	function processPage() {
		$('[component="posts"] img:not(.not-responsive), [component="aboutme"] img:not(.not-responsive)').addClass('img-responsive');
	}

	function updateButtons() {
		var isSelfOrNotLoggedIn = yourid === theirid || parseInt(yourid, 10) === 0;
		$('#follow-btn').toggleClass('hide', isFollowing || isSelfOrNotLoggedIn);
		$('#unfollow-btn').toggleClass('hide', !isFollowing || isSelfOrNotLoggedIn);
		$('#chat-btn').toggleClass('hide', isSelfOrNotLoggedIn);
	}

	function onUserStatusChange(data) {
		if (parseInt(ajaxify.data.theirid, 10) !== parseInt(data.uid, 10)) {
			return;
		}

		app.updateUserStatus($('.account [data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
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

		app.parseAndTranslate('account/profile', 'posts', {posts: posts}, function(html) {

			$('[component="posts"]').append(html);
			html.find('.timeago').timeago();

			callback();
		});
	}

	return Account;
});
