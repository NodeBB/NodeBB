

'use strict';

/* globals define, app, translator, config, socket, ajaxify */

define('forum/topic/browsing', function() {

	var Browsing = {};

	Browsing.onUpdateUsersInRoom = function(data) {
		if(data && data.room.indexOf('topic_' + ajaxify.variables.get('topic_id')) !== -1) {
			for(var i=0; i<data.users.length; ++i) {
				addUserIcon(data.users[i]);
			}
			getReplyingUsers();
		}
	};

	Browsing.onUserEnter = function(data) {
		var activeEl = $('.thread_active_users');
		var user = activeEl.find('a[data-uid="' + data.uid + '"]');
		if (!user.length && activeEl.children().length < 10) {
			addUserIcon(data);
		} else {
			user.attr('data-count', parseInt(user.attr('data-count'), 10) + 1);
		}
	};

	Browsing.onUserLeave = function(uid) {
		var activeEl = $('.thread_active_users');
		var user = activeEl.find('a[data-uid="' + uid + '"]');
		if (user.length) {
			var count = Math.max(0, parseInt(user.attr('data-count'), 10) - 1);
			user.attr('data-count', count);
			if (count <= 0) {
				user.remove();
			}
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
		var activeEl = $('.thread_active_users');
		var user = activeEl.find('a[data-uid="'+ data.uid + '"]');
		if (user.length && data.status === 'offline') {
			user.parent().remove();
		}
	}

	function addUserIcon(user) {
		if (!user.userslug) {
			return;
		}
		var activeEl = $('.thread_active_users');
		var userEl = createUserIcon(user.uid, user.picture, user.userslug, user.username);
		activeEl.append(userEl);
		activeEl.find('a[data-uid] img').tooltip({
			placement: 'top'
		});
	}

	function createUserIcon(uid, picture, userslug, username) {
		if(!$('.thread_active_users').find('[data-uid="' + uid + '"]').length) {
			return $('<div class="inline-block"><a data-uid="' + uid + '" data-count="1" href="' + config.relative_path + '/user/' + userslug + '"><img title="' + username + '" src="'+ picture +'"/></a></div>');
		}
	}

	function getReplyingUsers() {
		var activeEl = $('.thread_active_users');
		socket.emit('modules.composer.getUsersByTid', ajaxify.variables.get('topic_id'), function(err, uids) {
			if (uids && uids.length) {
				for(var x=0;x<uids.length;x++) {
					activeEl.find('[data-uid="' + uids[x] + '"]').addClass('replying');
				}
			}
		});
	}

	return Browsing;
});