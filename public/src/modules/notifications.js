define(['sounds'], function(sound) {
	var Notifications = {};

	Notifications.prepareDOM = function() {
		var notifContainer = $('.notifications'),
			notifTrigger = notifContainer.children('a'),
			notifList = $('#notif-list'),
			notifIcon = $('.notifications > a > i');

		notifTrigger.on('click', function(e) {
			e.preventDefault();
			if (!notifContainer.hasClass('open')) {

				socket.emit('notifications.get', null, function(err, data) {

					var	numRead = data.read.length,
						numUnread = data.unread.length,
						x;

					var html = '';

					if (!err && (data.read.length + data.unread.length) > 0) {
						var	image = '';
						for (x = 0; x < numUnread; x++) {
							if (data.unread[x].image) {
								image = '<img class="image" src="' + data.unread[x].image + '" />';
							} else {
								image = '';
							}
							html += '<li class="' + (data.unread[x].readClass || '') + '"><a href="' + data.unread[x].path + '">' + image + '<span class="pull-right relTime">' + utils.relativeTime(data.unread[x].datetime, true) + '</span><span class="text">' + data.unread[x].text + '</span></a></li>';
						}

						for (x = 0; x < numRead; x++) {
							if (data.read[x].image) {
								image = '<img src="' + data.read[x].image + '" />';
							} else {
								image = '';
							}
							html += '<li class="' + data.read[x].readClass + '"><a href="' + data.read[x].path + '">' + image + '<span class="pull-right relTime">' + utils.relativeTime(data.read[x].datetime, true) + '</span><span class="text">' + data.read[x].text + '</span></a></li>';
						}
						addSeeAllLink(replaceHtml);

					} else {
						translator.translate('<li class="no-notifs"><a>[[notifications:no_notifs]]</a></li>', function(translated) {
							html += translated;
							addSeeAllLink(replaceHtml);
						});
					}

					function addSeeAllLink(callback) {
						translator.translate('<li class="pagelink"><a href="' + RELATIVE_PATH + '/notifications">[[notifications:see_all]]</a></li>', function(translated) {
							html += translated;
							callback();
						});
					}

					function replaceHtml() {
						notifList.html(html);
					}

					updateNotifCount(data.unread.length);

					socket.emit('modules.notifications.mark_all_read', null, function(err) {
						if (!err) {
							updateNotifCount(0);
						}
					});
				});
			}
		});

		var	updateNotifCount = function(count) {
			if (count > 0) {
				notifIcon.removeClass('fa-bell-o').addClass('fa-bell');
			} else {
				notifIcon.removeClass('fa-bell').addClass('fa-bell-o');
			}

			notifIcon.toggleClass('unread-count', count > 0);
			notifIcon.attr('data-content', count > 20 ? '20+' : count);

			Tinycon.setBubble(count);
			localStorage.setItem('notifications:count', count);
		};

		socket.emit('notifications.getCount', function(err, count) {
			if (!err) {
				updateNotifCount(count);
			} else {
				updateNotifCount(0);
			}
		});

		socket.on('event:new_notification', function() {

			app.alert({
				alert_id: 'new_notif',
				title: '[[notifications:new_notification]]',
				message: '[[notifications:you_have_unread_notifications]]',
				type: 'warning',
				timeout: 2000
			});
			app.refreshTitle();

			if (ajaxify.currentPage === 'notifications') {
				ajaxify.refresh();
			}

			var	savedCount = parseInt(localStorage.getItem('notifications:count'), 10) || 0;
			updateNotifCount(savedCount + 1);

			sound.play('notification');
		});
		socket.on('event:notifications.updateCount', function(count) {
			updateNotifCount(count);
		});
	};

	return Notifications;
});
