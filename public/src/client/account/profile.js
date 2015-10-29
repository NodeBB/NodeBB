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

		$('#follow-btn').on('click', function() {
			return toggleFollow('follow');
		});

		$('#unfollow-btn').on('click', function() {
			return toggleFollow('unfollow');
		});

		$('#chat-btn').on('click', function() {
			app.openChat($('.account-username').html(), theirid);
		});

		$('#banAccountBtn').on('click', banAccount);
		$('#unbanAccountBtn').on('click', unbanAccount);
		$('#deleteAccountBtn').on('click', deleteAccount);

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
		if (parseInt(ajaxify.data.theirid, 10) !== parseInt(data.uid, 10)) {
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

	function banAccount() {
		translator.translate('[[user:ban_account_confirm]]', function(translated) {
			bootbox.confirm(translated, function(confirm) {
				if (!confirm) {
					return;
				}
				socket.emit('admin.user.banUsers', [ajaxify.data.theirid], function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					$('#banAccountBtn').toggleClass('hide', true);
					$('#banLabel, #unbanAccountBtn').toggleClass('hide', false);
				});
			});
		});
	}

	function unbanAccount() {
		socket.emit('admin.user.unbanUsers', [ajaxify.data.theirid], function(err) {
			if (err) {
				return app.alertError(err.message);
			}
			$('#banAccountBtn').toggleClass('hide', false);
			$('#banLabel, #unbanAccountBtn').toggleClass('hide', true);
		});
	}

	function deleteAccount() {
		translator.translate('[[user:delete_this_account_confirm]]', function(translated) {
			bootbox.confirm(translated, function(confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('admin.user.deleteUsers', [ajaxify.data.theirid], function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[user:account-deleted]]');
					history.back();
				});
			});
		});
	}

	return Account;
});
