var socket,
	config,
	app = {
		"username": null,
		"uid": null,
		"isFocused": true,
		"currentRoom": null
	};

(function () {
	var showWelcomeMessage = false;

	app.loadConfig = function() {
		$.ajax({
			url: RELATIVE_PATH + '/api/config',
			success: function (data) {
				config = data;
				if(socket) {
					socket.disconnect();
					setTimeout(function() {
						socket.socket.connect();
					}, 200);
				} else {
					var max_reconnection_attemps = 5;
					var reconnection_delay = 200;
					socket = io.connect('', {
						'max reconnection attempts': max_reconnection_attemps,
						'reconnection delay': reconnection_delay
					});

					var reconnecting = false,
						reconnectEl, reconnectTimer;

					socket.on('event:connect', function (data) {
						app.username = data.username;
						app.uid = data.uid;

						app.showLoginMessage();
						socket.emit('api:meta.updateHeader', {
							fields: ['username', 'picture', 'userslug']
						}, app.updateHeader);
					});

					socket.on('event:alert', function (data) {
						app.alert(data);
					});

					socket.on('connect', function (data) {
						if (reconnecting) {
							reconnectEl.tooltip('destroy');
							reconnectEl.html('<i class="fa fa-check"></i>');
							reconnecting = false;

							// Rejoin room that was left when we disconnected
							var	url_parts = document.location.pathname.slice(RELATIVE_PATH.length).split('/').slice(1),
								room;
							switch(url_parts[0]) {
								case 'user':
									room = 'user/' + templates.get('theirid');
								case 'topic':
									room = 'topic_' + url_parts[1];
									break;
								case 'category':
									room = 'category_' + url_parts[1];
									break;
								case 'recent':	// intentional fall-through
								case 'unread':
									room = 'recent_posts';
									break;
								case 'admin':
									room = 'admin';
									break;

								default:
									room = 'global';
									break;
							}
							app.enterRoom(room, true);

							socket.emit('reconnected');

							setTimeout(function() {
								reconnectEl.removeClass('active').addClass("hide");
							}, 3000);
						}

						socket.emit('api:meta.updateHeader', {
							fields: ['username', 'picture', 'userslug']
						}, app.updateHeader);
					});

					socket.on('event:disconnect', function() {
						socket.socket.connect();
					});

					socket.on('reconnecting', function (data, attempt) {
						if(attempt == max_reconnection_attemps) {
							socket.socket.reconnectionAttempts = 0;
							socket.socket.reconnectionDelay = reconnection_delay;
							return;
						}

						if (!reconnectEl) reconnectEl = $('#reconnect');
						reconnecting = true;

						if (!reconnectEl.hasClass('active')) reconnectEl.html('<i class="fa fa-spinner fa-spin"></i>');
						reconnectEl.addClass('active').removeClass("hide");

						reconnectEl.tooltip({
							placement: 'bottom'
						});
					});

					socket.on('event:banned', function() {
						app.alert({
							title: 'Banned',
							message: 'You are banned you will be logged out!',
							type: 'warning',
							timeout: 1000
						});

						setTimeout(app.logout, 1000);
					});

					app.enterRoom('global');
				}
			},
			async: false
		});
	};

	app.logout = function() {
		$.post(RELATIVE_PATH + '/logout', {
			_csrf: $('#csrf_token').val()
		}, function() {
			window.location.href = RELATIVE_PATH + '/';
		});
	};

	// takes a string like 1000 and returns 1,000
	app.addCommas = function (text) {
		return text.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
	};

	// use unique alert_id to have multiple alerts visible at a time, use the same alert_id to fade out the current instance
	// type : error, success, info, warning/notify
	// title = bolded title text
	// message = alert message content
	// timeout default = permanent
	// location : alert_window (default) or content
	app.alert = function (params) {
		var alert_id = 'alert_button_' + ((params.alert_id) ? params.alert_id : new Date().getTime());

		var alert = $('#' + alert_id);
		var title = params.title || '';

		function startTimeout(div, timeout) {
			var timeoutId = setTimeout(function () {
				$(div).fadeOut(1000, function () {
					$(this).remove();
				});
			}, timeout);

			$(div).attr('timeoutId', timeoutId);
		}

		if (alert.length > 0) {
			alert.find('strong').html(title);
			alert.find('p').html(params.message);
			alert.attr('class', "alert toaster-alert " + "alert-" + params.type);

			clearTimeout(alert.attr('timeoutId'));
			startTimeout(alert, params.timeout);
		} else {
			var div = $('<div id="' + alert_id + '" class="alert toaster-alert alert-' + params.type +'"></div>'),
				button = $('<button class="close">&times;</button>'),
				strong = $('<strong>' + title + '</strong>'),
				p = $('<p>' + params.message + '</p>');

			div.append(button)
				.append(strong)
				.append(p);

			button.on('click', function () {
				div.remove();
			});

			if (params.location == null)
				params.location = 'alert_window';

			$('#' + params.location).prepend(div.fadeIn('100'));

			if (params.timeout) {
				startTimeout(div, params.timeout);
			}

			if (params.clickfn) {
				div.on('click', function () {
					params.clickfn();
					div.fadeOut(500, function () {
						$(this).remove();
					});
				});
			}
		}
	};

	app.alertSuccess = function (message, timeout) {
		if (!timeout)
			timeout = 2000;

		app.alert({
			title: 'Success',
			message: message,
			type: 'success',
			timeout: timeout
		});
	};

	app.alertError = function (message, timeout) {
		if (!timeout)
			timeout = 2000;

		app.alert({
			title: 'Error',
			message: message,
			type: 'danger',
			timeout: timeout
		});
	};

	app.enterRoom = function (room, force) {
		if (socket) {
			if (app.currentRoom === room && !force) {
				return;
			}

			socket.emit('event:enter_room', {
				'enter': room,
				'leave': app.currentRoom
			});

			app.currentRoom = room;
		}
	};

	app.populateOnlineUsers = function () {
		var uids = [];

		jQuery('.post-row').each(function () {
			uids.push(this.getAttribute('data-uid'));
		});

		socket.emit('api:user.get_online_users', uids, function (users) {
			jQuery('a.username-field').each(function () {
				if (this.processed === true)
					return;

				var el = jQuery(this),
					uid = el.parents('li').attr('data-uid');

				if (uid && jQuery.inArray(uid, users) !== -1) {
					el.find('i').remove();
					el.prepend('<i class="fa fa-circle"></i>');
				} else {
					el.find('i').remove();
					el.prepend('<i class="fa fa-circle-o"></i>');
				}

				el.processed = true;
			});
			jQuery('button .username-field').each(function () {
				//DRY FAIL
				if (this.processed === true)
					return;

				var el = jQuery(this),
					uid = el.parents('li').attr('data-uid');

				if (uid && jQuery.inArray(uid, users) !== -1) {
					el.parent().addClass('btn-success');
				} else {
					el.parent().addClass('btn-danger');
				}

				el.processed = true;
			});
		});
	};

	function highlightNavigationLink() {
		var path = window.location.pathname,
			parts = path.split('/'),
			active = parts[parts.length - 1];

		jQuery('#main-nav li').removeClass('active');
		if (active) {
			jQuery('#main-nav li a').each(function () {
				var href = this.getAttribute('href');
				if (active == "sort-posts" || active == "sort-reputation" || active == "search" || active == "latest" || active == "online")
					active = 'users';
				if (href && href.match(active)) {
					jQuery(this.parentNode).addClass('active');
					return false;
				}
			});
		}
	};

	app.createUserTooltips = function() {
		$('img[title].teaser-pic,img[title].user-img').each(function() {
			$(this).tooltip({
				placement: 'top',
				title: $(this).attr('title')
			});
		});
	};

	app.makeNumbersHumanReadable = function(elements) {
		elements.each(function() {
			$(this).html(utils.makeNumberHumanReadable($(this).attr('title')));
		});
	};

	app.processPage = function () {
		app.populateOnlineUsers();

		highlightNavigationLink();

		$('span.timeago').timeago();
		$('.post-content img').addClass('img-responsive');

		app.makeNumbersHumanReadable($('.human-readable-number'));

		app.createUserTooltips();

		setTimeout(function () {
			window.scrollTo(0, 1); // rehide address bar on mobile after page load completes.
		}, 100);
	};

	app.showLoginMessage = function () {
		function showAlert() {
			app.alert({
				type: 'success',
				title: 'Welcome Back ' + app.username + '!',
				message: 'You have successfully logged in!',
				timeout: 5000
			});
		}

		if (showWelcomeMessage) {
			showWelcomeMessage = false;
			if (document.readyState !== 'complete') {
				$(document).ready(showAlert);
			} else {
				showAlert();
			}
		}
	};

	app.addCommasToNumbers = function () {
		$('.formatted-number').each(function (index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
	};

	app.openChat = function (username, touid) {
		if (username === app.username) {
			app.alert({
				type: 'warning',
				title: 'Invalid Chat',
				message: "You can't chat with yourself!",
				timeout: 5000
			});

			return;
		}

		if (!app.username) {
			app.alert({
				type: 'danger',
				title: 'Not Logged In',
				message: 'Please log in to chat with <strong>' + username + '</strong>',
				timeout: 5000
			});

			return;
		}

		require(['chat'], function (chat) {
			if (!chat.modalExists(touid)) {
				chat.createModal(username, touid, loadAndCenter);
			} else {
				loadAndCenter(chat.getModal(touid));
			}

			function loadAndCenter(chatModal) {
				chat.load(chatModal.attr('UUID'));
				chat.center(chatModal);
			}
		});
	};

	app.scrollToTop = function () {
		$('body,html').animate({
			scrollTop: 0
		});
	};

	app.scrollToBottom = function () {
		$('body,html').animate({
			scrollTop: $('html').height() - 100
		});
	};

	var	titleObj = {
			active: false,
			interval: undefined,
			titles: []
		};
	app.alternatingTitle = function (title) {
		if (typeof title !== 'string') return;

		if (title.length > 0) {
			titleObj.titles[1] = title;
			if (titleObj.interval) {
				clearInterval(titleObj.interval);
			}
			titleObj.interval = setInterval(function() {
				window.document.title = titleObj.titles[titleObj.titles.indexOf(window.document.title) ^ 1];
			}, 2000);
		} else {
			if (titleObj.interval) {
				clearInterval(titleObj.interval);
			}
			if (titleObj.titles[0]) window.document.title = titleObj.titles[0];
		}
	};

	app.refreshTitle = function(url) {
		if (!url) {
			var a = document.createElement('a');
			a.href = document.location;
			url = a.pathname.slice(1);
		}

		socket.emit('api:meta.buildTitle', url, function(title, numNotifications) {
			titleObj.titles[0] = (numNotifications > 0 ? '(' + numNotifications + ') ' : '') + title;
			app.alternatingTitle('');
		});
	};

	app.updateHeader = function(data) {
		$('#search-button').on('click', function() {
			$('#search-fields').removeClass('hide').show();
			$(this).hide();
			$('#search-fields input').focus();

			$('#search-form').on('submit', function() {
				$('#search-fields').hide();
				$('#search-button').show();
			});

			$('#search-fields input').on('blur', function() {
				$('#search-fields').hide();
				$('#search-button').show();
			});
		});

		var loggedInMenu = $('#logged-in-menu'),
			isLoggedIn = data.uid > 0,
			allowGuestSearching = (data.config || {}).allowGuestSearching === '1';

		if (isLoggedIn) {
			$('.nodebb-loggedin').show();
			$('.nodebb-loggedout').hide();

			$('#logged-out-menu').addClass('hide');
			$('#logged-in-menu').removeClass('hide');

			$('#search-button').removeClass("hide").show();

			var userLabel = loggedInMenu.find('#user_label');

			if (userLabel.length) {
				if (data['userslug'])
					userLabel.find('#user-profile-link').attr('href', RELATIVE_PATH + '/user/' + data['userslug']);
				if (data['picture'])
					userLabel.find('img').attr('src', data['picture']);
				if (data['username'])
					userLabel.find('span').html(data['username']);

				$('#logout-link').on('click', app.logout);
			}
		} else {
			if (allowGuestSearching) {
				$('#search-button').removeClass("hide").show();
			} else {
				$('#search-button').addClass("hide").hide();
			}

			$('.nodebb-loggedin').hide();
			$('.nodebb-loggedout').show();

			$('#logged-out-menu').removeClass('hide');
			$('#logged-in-menu').addClass('hide');

		}

		$('#main-nav a,#user-control-list a,#logged-out-menu .dropdown-menu a').off('click').on('click', function() {
			if($('.navbar .navbar-collapse').hasClass('in'))
				$('.navbar-header button').click();
		});
	};

	jQuery('document').ready(function () {
		$('#search-form').on('submit', function () {
			var input = $(this).find('input');
			ajaxify.go("search/" + input.val());
			input.val('');
			return false;
		});

		$(window).blur(function(){
			app.isFocused = false;
		});

		$(window).focus(function(){
			app.isFocused = true;

			app.alternatingTitle('');
		});

		templates.setGlobal('relative_path', RELATIVE_PATH);
	});

	showWelcomeMessage = location.href.indexOf('loggedin') !== -1;

	app.loadConfig();
	app.alternatingTitle('');
}());