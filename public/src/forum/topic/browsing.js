

'use strict';

/* globals define, app, translator, config, socket, ajaxify */

define(function() {

	var Browsing = {};

	Browsing.onUpdateUsersInRoom = function(data) {
		if(data && data.room.indexOf('topic_' + ajaxify.variables.get('topic_id')) !== -1) {
			var activeEl = $('.thread_active_users');

			// remove users that are no longer here
			activeEl.find('a').each(function(index, element) {
				if(element) {
					var uid = $(element).attr('data-uid');
					var absent = data.users.every(function(user) {
						return parseInt(user.uid, 10) !== parseInt(uid, 10);
					});

					if (absent) {
						$(element).parent().remove();
					}
				}
			});

			var i=0, icon;
			// add self
			for(i = 0; i<data.users.length; ++i) {
				if(parseInt(data.users[i].uid, 10) === parseInt(app.uid, 10)) {
					icon = createUserIcon(data.users[i].uid, data.users[i].picture, data.users[i].userslug, data.users[i].username);
					activeEl.prepend(icon);
					data.users.splice(i, 1);
					break;
				}
			}
			// add other users
			for(i=0; i<data.users.length; ++i) {
				icon = createUserIcon(data.users[i].uid, data.users[i].picture, data.users[i].userslug, data.users[i].username);
				activeEl.append(icon);
				if(activeEl.children().length > 8) {
					break;
				}
			}

			activeEl.find('a[data-uid] img').tooltip({
				placement: 'top'
			});

			var remainingUsers = data.users.length - 9;
			remainingUsers = remainingUsers < 0 ? 0 : remainingUsers;
			var anonymousCount = parseInt(data.anonymousCount, 10);
			activeEl.find('.anonymous-box').remove();
			if(anonymousCount || remainingUsers) {

				var anonLink = $('<div class="anonymous-box inline-block"><i class="fa fa-user"></i></div>');
				activeEl.append(anonLink);

				var title = '';
				if(remainingUsers && anonymousCount) {
					title = '[[topic:more_users_and_guests, ' + remainingUsers + ', ' + anonymousCount + ']]';
				} else if(remainingUsers) {
					title = '[[topic:more_users, ' + remainingUsers + ']]';
				} else {
					title = '[[topic:more_guests, ' + anonymousCount + ']]';
				}

				translator.translate(title, function(translated) {
					$('.anonymous-box').tooltip({
						placement: 'top',
						title: translated
					});
				});
			}

			getReplyingUsers();
		}

		app.populateOnlineUsers();
	};

	Browsing.onUserOnline = function(err, data) {
		app.populateOnlineUsers();

		updateBrowsingUsers(data);
	};

	function updateBrowsingUsers(data) {
		var activeEl = $('.thread_active_users');
		var user = activeEl.find('a[data-uid="'+ data.uid + '"]');
		if (user.length && !data.online) {
			user.parent().remove();
		} else if(!user.length && data.online && data.rooms.indexOf('topic_' + ajaxify.variables.get('topic_id')) !== -1) {
			user = createUserIcon(data.uid, data.picture, data.userslug, data.username);
			activeEl.append(user);
			activeEl.find('a[data-uid] img').tooltip({
				placement: 'top'
			});
		}
	}

	function createUserIcon(uid, picture, userslug, username) {
		if(!$('.thread_active_users').find('[data-uid="' + uid + '"]').length) {
			return $('<div class="inline-block"><a data-uid="' + uid + '" href="' + config.relative_path + '/user/' + userslug + '"><img title="' + username + '" src="'+ picture +'"/></a></div>');
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