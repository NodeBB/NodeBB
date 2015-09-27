

'use strict';

/* globals define, app, config, socket, ajaxify */

define('forum/topic/browsing', function() {

	var Browsing = {};

	Browsing.onUpdateUsersInRoom = function(data) {
		if (data && data.room.indexOf('topic_' + ajaxify.data.tid) !== -1) {
			$('[component="topic/browsing/list"]').parent().toggleClass('hidden', !data.users.length);
			for (var i=0; i<data.users.length; ++i) {
				addUserIcon(data.users[i]);
			}

			updateUserCount(data.hidden);
		}
	};

	Browsing.onUserEnter = function(data) {
		var browsingList = $('[component="topic/browsing/list"]');
		var user = browsingList.find('a[data-uid="' + data.uid + '"]');
		if (!user.length && browsingList.first().children().length < 10) {
			addUserIcon(data);
		} else if (user.length) {
			user.attr('data-count', parseInt(user.attr('data-count'), 10) + 1);
		} else {
			increaseUserCount(1);
		}
		Browsing.onUserStatusChange(data);
	};

	Browsing.onUserLeave = function(uid) {
		if (app.user.uid === parseInt(uid, 10)) {
			return;
		}
		var browsingList = $('[component="topic/browsing/list"]');
		var user = browsingList.find('a[data-uid="' + uid + '"]');
		if (user.length) {
			var count = Math.max(0, parseInt(user.attr('data-count'), 10) - 1);
			user.attr('data-count', count);
			if (count <= 0) {
				user.parent().remove();
				if (!browsingList.children(':not(.hidden)').length) {
					browsingList.parent().addClass('hidden');
				}
			}
		} else {
			increaseUserCount(-1);
		}
	};

	Browsing.onUserStatusChange = function(data) {
		app.updateUserStatus($('[data-uid="' + data.uid + '"] [component="user/status"]'), data.status);

		updateBrowsingUsers(data);
	};

	function updateBrowsingUsers(data) {
		var browsingList = $('[component="topic/browsing/list"]');
		var user = browsingList.find('a[data-uid="'+ data.uid + '"]');
		if (user.length) {
			user.parent().toggleClass('hidden', data.status === 'offline');
			browsingList.parent().toggleClass('hidden', !browsingList.children(':not(.hidden)').length);
		}
	}

	function addUserIcon(user) {
		if (!user.userslug) {
			return;
		}
		console.log(user);
		var browsingList = $('[component="topic/browsing/list"]');
		var userEl = createUserIcon(user.uid, user.picture, user.userslug, user.username, user['icon:bgColor'], user['icon:text']);
		var isSelf = parseInt(user.uid, 10) === parseInt(app.user.uid, 10);
		if (isSelf) {
			browsingList.prepend(userEl);
		} else {
			browsingList.append(userEl);
		}

		browsingList.find('a[data-uid]').tooltip({
			placement: 'top'
		});
	}

	function createUserIcon(uid, picture, userslug, username, iconBg, iconText) {
		if (!$('[component="topic/browsing/list"]').find('[data-uid="' + uid + '"]').length) {
			console.log(iconBg, iconText);
			var imgOrIcon = picture ?
				'<img src="'+ picture +'" />' :
				'<div class="user-icon" style="background-color: ' + iconBg + ';">' + iconText + '</div>';

			return $('<div class="inline-block"><a title="' + username + '" data-uid="' + uid + '" data-count="1" href="' + config.relative_path + '/user/' + userslug + '">' + imgOrIcon + '</a></div>');
		}
	}

	function updateUserCount(count) {
		count = parseInt(count, 10);
		if (!count || count < 0) {
			count = 0;
		}
		$('[component="topic/browsing/count"]').text(count).parent().toggleClass('hidden', count === 0);
	}

	function increaseUserCount(incr) {
		updateUserCount(parseInt($('[component="topic/browsing/count"]').first().text(), 10) + incr);
	}

	return Browsing;
});