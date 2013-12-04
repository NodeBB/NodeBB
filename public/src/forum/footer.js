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
		notifIcon = document.querySelector('.notifications a i');
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
				console.log(data);
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
					notifIcon.className = 'fa fa-bell active';
				} else {
					notifIcon.className = 'fa fa-bell-o';
				}

				socket.emit('api:notifications.mark_all_read', null, function() {
					notifIcon.className = 'fa fa-bell-o';
					utils.refreshTitle();
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

	socket.on('event:new_notification', function() {
		document.querySelector('.notifications a i').className = 'fa fa-bell active';
		app.alert({
			alert_id: 'new_notif',
			title: 'New notification',
			message: 'You have unread notifications.',
			type: 'warning',
			timeout: 2000
		});
		utils.refreshTitle();
	});


	socket.on('chatMessage', function(data) {

		require(['chat'], function(chat) {
			var modal = null;
			if (chat.modalExists(data.fromuid)) {
				modal = chat.getModal(data.fromuid);
				chat.appendChatMessage(modal, data.message, data.timestamp);
			} else {
				modal = chat.createModal(data.username, data.fromuid);
			}

			chat.load(modal.attr('UUID'));
		});
	});

	require(['mobileMenu'], function(mobileMenu) {
		mobileMenu.init();
	});
}());
