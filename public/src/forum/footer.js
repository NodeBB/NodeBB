(function() {

	socket.emit('api:updateHeader', {
		fields: ['username', 'picture', 'userslug']
	});

	socket.on('api:updateHeader', function(data) {
		jQuery('#search-button').on('click', function() {
			jQuery('#search-fields').removeClass('hide').show();
			jQuery(this).hide();
			jQuery('#search-fields input').focus()

			jQuery('#search-form').on('submit', function() {
				jQuery('#search-fields').hide();
				jQuery('#search-button').show();
			});

			$('#search-fields input').on('blur', function() {
				$('#search-fields').hide();
				$('#search-button').show();
			});
		});

		var loggedInMenu = $('#logged-in-menu'),
			isLoggedIn = data.uid > 0;

		if (isLoggedIn) {
			jQuery('.nodebb-loggedin').show();
			jQuery('.nodebb-loggedout').hide();

			$('#logged-out-menu').addClass('hide');
			$('#logged-in-menu').removeClass('hide');

			$('#search-button').show();

			var userLabel = loggedInMenu.find('#user_label');

			if (userLabel.length) {
				if (data['userslug'])
					userLabel.find('#user-profile-link').attr('href', '/user/' + data['userslug']);
				if (data['picture'])
					userLabel.find('img').attr('src', data['picture']);
				if (data['username'])
					userLabel.find('span').html(data['username']);

				$('#logout-link').on('click', app.logout);
			}
		} else {
			$('#search-button').hide();

			jQuery('.nodebb-loggedin').hide();
			jQuery('.nodebb-loggedout').show();

			$('#logged-out-menu').removeClass('hide');
			$('#logged-in-menu').addClass('hide');

		}

		$('#main-nav a,#user-control-list a,#logged-out-menu .dropdown-menu a').off('click').on('click', function() {
			if($('.navbar .navbar-collapse').hasClass('in'))
				$('.navbar-header button').click();
		});
	});

	// Notifications dropdown
	var notifContainer = document.getElementsByClassName('notifications')[0],
		notifTrigger = notifContainer.querySelector('a'),
		notifList = document.getElementById('notif-list'),
		notifIcon = $('.notifications a');
	notifTrigger.addEventListener('click', function(e) {
		e.preventDefault();
		if (notifContainer.className.indexOf('open') === -1) {
			socket.emit('api:notifications.get', null, function(data) {
				var notifFrag = document.createDocumentFragment(),
					notifEl = document.createElement('li'),
					numRead = data.read.length,
					numUnread = data.unread.length,
					x;
				notifList.innerHTML = '';
				if ((data.read.length + data.unread.length) > 0) {
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

				socket.emit('api:notifications.mark_all_read', null, function() {
					notifIcon.toggleClass('active', false);
					app.refreshTitle();

					// Update favicon + local count
					Tinycon.setBubble(0);
					localStorage.setItem('notifications:count', 0);
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
			if (nid > 0) socket.emit('api:notifications.mark_read', nid);
		}
	});

	socket.emit('api:notifications.getCount', function(err, count) {
		// Update notification icon, if necessary
		if (count > 0) {
			notifIcon.toggleClass('active', true);
		} else {
			notifIcon.toggleClass('active', false);
		}

		// Update the favicon + saved local count
		Tinycon.setBubble(count);
		localStorage.setItem('notifications:count', count);
	});

	if (localStorage.getItem('notifications:count') !== null) {
		Tinycon.setBubble(parseInt(localStorage.getItem('notifications:count'), 10));
	}

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

		// Update the favicon + local storage
		var	savedCount = parseInt(localStorage.getItem('notifications:count'),10) || 0;
		localStorage.setItem('notifications:count', savedCount+1);
		Tinycon.setBubble(savedCount+1);
	});

	// Chats Dropdown
	var	chatsToggleEl = $('#chat_dropdown'),
		chatsListEl = $('#chat-list'),
		chatDropdownEl = chatsToggleEl.parent();
	chatsToggleEl.on('click', function() {
		if (chatDropdownEl.hasClass('open')) {
			return;
		}

		socket.emit('api:chats.list', function(chats) {
			var	chatsFrag = document.createDocumentFragment(),
				chatEl = document.createElement('li'),
				numChats = chats.length,
				x, userObj;

			if (numChats > 0) {
				for(x=0;x<numChats;x++) {
					userObj = chats[x];
					chatEl.setAttribute('data-uid', userObj.uid);
					chatEl.innerHTML = '<a href="javascript:app.openChat(\'' + userObj.username + '\', ' + userObj.uid + ');"><img src="' + userObj.picture + '" title="' + userObj.username + '" />' + userObj.username + '</a>';

					chatsFrag.appendChild(chatEl.cloneNode(true));
				}
			} else {
				chatEl.innerHTML = '<a href="#">No Recent Chats</a>';
				chatsFrag.appendChild(chatEl.cloneNode(true));
			}

			chatsListEl.empty();
			chatsListEl.html(chatsFrag);
		});
	});

	socket.on('chatMessage', function(data) {
		require(['chat'], function(chat) {
			var modal = null;
			if (chat.modalExists(data.fromuid)) {
				modal = chat.getModal(data.fromuid);
				chat.appendChatMessage(modal, data.message, data.timestamp);

				if (modal.is(":visible")) {
					chat.load(modal.attr('UUID'));
				} else {
					chat.toggleNew(modal.attr('UUID'), true);
					app.alternatingTitle(data.username + ' has messaged you');
				}
			} else {
				modal = chat.createModal(data.username, data.fromuid);
				chat.toggleNew(modal.attr('UUID'), true);
				app.alternatingTitle(data.username + ' has messaged you');
			}
		});
	});

	function updateUnreadCount(count) {
		var badge = $('#numUnreadBadge');
			badge.html(count > 20 ? '20+' : count);

			if (count > 0) {
				badge
					.removeClass('badge-inverse')
					.addClass('badge-important');
			} else {
				badge
					.removeClass('badge-important')
					.addClass('badge-inverse');
			}
	}

	socket.on('event:unread.updateCount', updateUnreadCount);
	socket.emit('api:unread.count', updateUnreadCount);

	require(['mobileMenu'], function(mobileMenu) {
		mobileMenu.init();
	});
}());
