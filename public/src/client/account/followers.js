'use strict';

/* globals define, socket, utils */

define('forum/account/followers', ['forum/account/header', 'forum/infinitescroll'], function(header, infinitescroll) {
	var	Followers = {};

	Followers.init = function() {
		header.init();

		infinitescroll.init(function(direction) {
			Followers.loadMore(direction, 'account/followers', 'followers:' + ajaxify.data.uid);
		});
	};

	Followers.loadMore = function(direction, tpl, set) {
		if (direction < 0) {
			return;
		}

		infinitescroll.loadMore('user.loadMore', {
			set: set,
			after: $('#users-container').attr('data-nextstart')
		}, function(data, done) {
			if (data.users && data.users.length) {
				onUsersLoaded(tpl, data.users, done);
				$('#users-container').attr('data-nextstart', data.nextStart);
			} else {
				done();
			}
		});
	};

	function onUsersLoaded(tpl, users, callback) {
		app.parseAndTranslate(tpl, 'users', {users: users}, function(html) {
			$('#users-container').append(html);
			utils.addCommasToNumbers(html.find('.formatted-number'));
			callback();
		});
	}

	return Followers;
});
