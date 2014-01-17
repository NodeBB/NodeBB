define(function() {
	var Notifications = {};

	Notifications.prepareDOM = function() {
		// Notifications dropdown
		var notifContainer = document.getElementsByClassName('notifications')[0],
			notifTrigger = notifContainer.querySelector('a'),
			notifList = document.getElementById('notif-list'),
			notifIcon = $('.notifications a');

		notifTrigger.addEventListener('click', function(e) {
			e.preventDefault();
			if (notifContainer.className.indexOf('open') === -1) {
				socket.emit('notifications.get', null, function(err, data) {
					var notifFrag = document.createDocumentFragment(),
						notifEl = document.createElement('li'),
						numRead = data.read.length,
						numUnread = data.unread.length,
						x;
					notifList.innerHTML = '';
					if (!err && (data.read.length + data.unread.length) > 0) {
						for (x = 0; x < numUnread; x++) {
							notifEl.setAttribute('data-nid', data.unread[x].nid);
							notifEl.className = 'unread';
							notifEl.innerHTML = '<a href="' + data.unread[x].path + '"><span class="pull-right">' + utils.relativeTime(data.unread[x].datetime, true) + '</span>' + data.unread[x].text + '</a>';
							notifFrag.appendChild(notifEl.cloneNode(true));
						}
						for (x = 0; x < numRead; x++) {
							notifEl.setAttribute('data-nid', data.read[x].nid);
							notifEl.className = '';
							notifEl.innerHTML = '<a href="' + data.read[x].path + '"><span class="pull-right">' + utils.relativeTime(data.read[x].datetime, true) + '</span>' + data.read[x].text + '</a>';
							notifFrag.appendChild(notifEl.cloneNode(true));
						}
					} else {
						notifEl.className = 'no-notifs';
						notifEl.innerHTML = '<a>You have no notifications</a>';
						notifFrag.appendChild(notifEl.cloneNode(true));
					}

					// Add dedicated link to /notifications
					notifEl.removeAttribute('data-nid');
					notifEl.className = 'pagelink';
					notifEl.innerHTML = '<a href="' + RELATIVE_PATH + '/notifications">See all Notifications</a>';
					notifFrag.appendChild(notifEl.cloneNode(true));

					notifList.appendChild(notifFrag);

					if (data.unread.length > 0) {
						notifIcon.toggleClass('active', true);
					} else {
						notifIcon.toggleClass('active', false);
					}

					socket.emit('modules.notifications.mark_all_read', null, function(err) {
						if (!err) {
							notifIcon.toggleClass('active', false);
							app.refreshTitle();

							// Update favicon + local count
							Tinycon.setBubble(0);
							localStorage.setItem('notifications:count', 0);
						}
					});
				});
			}
		});

		notifList.addEventListener('click', function(e) {
			var target;
			switch (e.target.nodeName) {
				case 'SPAN':
					target = e.target.parentNode.parentNode;
					break;
				case 'A':
					target = e.target.parentNode;
					break;
				case 'li':
					target = e.target;
					break;
			}
			if (target) {
				var nid = parseInt(target.getAttribute('data-nid'));
				if (nid > 0) socket.emit('modules.notifications.mark_read', nid);
			}
		});

		var	updateNotifCount = function(count) {
			// Update notification icon, if necessary
			if (count > 0) {
				notifIcon.toggleClass('active', true);
			} else {
				notifIcon.toggleClass('active', false);
			}

			// Update the favicon + saved local count
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
			notifIcon.toggleClass('active', true);
			app.alert({
				alert_id: 'new_notif',
				title: 'New notification',
				message: 'You have unread notifications.',
				type: 'warning',
				timeout: 2000
			});
			app.refreshTitle();

			if (ajaxify.currentPage === 'notifications') {
				ajaxify.refresh();
			}

			// Update the favicon + local storage
			var	savedCount = parseInt(localStorage.getItem('notifications:count'),10) || 0;
			updateNotifCount(savedCount+1);
		});
		socket.on('event:notifications.updateCount', function(count) {
			updateNotifCount(count);
		});
	};

	return Notifications;
});