

'use strict';

/* globals define, app, translator, config, socket, ajaxify */

define('forum/topic/browsing', function() {

	var Browsing = {};

	Browsing.onUpdateUsersInRoom = function(data) {
		if (data && data.room.indexOf('topic_' + ajaxify.variables.get('topic_id')) !== -1) {
			$('[component="topic/browsing/list"]').parent().toggleClass('hidden', !data.users.length);
			for(var i=0; i<data.users.length; ++i) {
				addUserIcon(data.users[i]);	
			}

			updateUserCount(data.total);
		}
	};

	Browsing.onUserEnter = function(data) {
		var activeEl = $('[component="topic/browsing/list"]');
		var user = activeEl.find('a[data-uid="' + data.uid + '"]');
		if (!user.length && activeEl.first().children().length < 10) {
			addUserIcon(data);
		} else if (user.length) {
			user.attr('data-count', parseInt(user.attr('data-count'), 10) + 1);
		} else {
			increaseUserCount(1);
		}
	};

	Browsing.onUserLeave = function(uid) {
		if (app.user.uid === parseInt(uid, 10)) {
			return;
		}
		var user = $('[component="topic/browsing/list"]').find('a[data-uid="' + uid + '"]');
		if (user.length) {
			var count = Math.max(0, parseInt(user.attr('data-count'), 10) - 1);
			user.attr('data-count', count);
			if (count <= 0) {
				user.parent().remove();
			}
		} else {
			increaseUserCount(-1);
		}
	};

	Browsing.onUserStatusChange = function(data) {
		updateOnlineIcon($('.username-field[data-uid="' + data.uid + '"]'), data.status);

		updateBrowsingUsers(data);
	};

	function updateOnlineIcon(el, status) {
		translator.translate('[[global:' + status + ']]', function(translated) {
			el.siblings('i')
				.attr('class', 'fa fa-circle status ' + status)
				.attr('title', translated)
				.attr('data-original-title', translated);
		});
	}

	function updateBrowsingUsers(data) {
		var activeEl = $('[component="topic/browsing/list"]');
		var user = activeEl.find('a[data-uid="'+ data.uid + '"]');
		if (user.length && data.status === 'offline') {
			user.parent().remove();
		}
	}

	function addUserIcon(user) {
		if (!user.userslug) {
			return;
		}
		var activeEl = $('[component="topic/browsing/list"]');
		var userEl = createUserIcon(user.uid, user.picture, user.userslug, user.username);
		var isSelf = parseInt(user.uid, 10) === parseInt(app.user.uid, 10);
		if (isSelf) {
			activeEl.prepend(userEl);
		} else {
			activeEl.append(userEl);
		}

		activeEl.find('a[data-uid] img').tooltip({
			placement: 'top'
		});
	}

	function createUserIcon(uid, picture, userslug, username) {
		if(!$('[component="topic/browsing/list"]').find('[data-uid="' + uid + '"]').length) {
			return $('<div class="inline-block"><a data-uid="' + uid + '" data-count="1" href="' + config.relative_path + '/user/' + userslug + '"><img title="' + username + '" src="'+ picture +'"/></a></div>');
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