"use strict";
/*global io, templates, translator, ajaxify, utils, RELATIVE_PATH*/

var socket,
	config,
	app = {
		'username': null,
		'uid': null,
		'isFocused': true,
		'currentRoom': null,
		'widgets': {},
		'cacheBuster': null
	};

(function () {
	var showWelcomeMessage = false;
	var reconnecting = false;

	function onSocketConnect(data) {
		if (reconnecting) {
			var reconnectEl = $('#reconnect');

			reconnectEl.tooltip('destroy');
			reconnectEl.html('<i class="fa fa-check"></i>');
			reconnecting = false;

			// Rejoin room that was left when we disconnected
			var	url_parts = window.location.pathname.slice(RELATIVE_PATH.length).split('/').slice(1);
			var room;

			switch(url_parts[0]) {
				case 'user':
					room = 'user/' + ajaxify.variables.get('theirid');
				break;
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

			socket.emit('meta.reconnected');

			socket.removeAllListeners('event:nodebb.ready');
			socket.on('event:nodebb.ready', function(cacheBuster) {
				if (app.cacheBuster !== cacheBuster) {
					app.cacheBuster = cacheBuster;

					app.alert({
						alert_id: 'forum_updated',
						title: '[[global:updated.title]]',
						message: '[[global:updated.message]]',
						clickfn: function() {
							window.location.reload();
						},
						type: 'warning'
					});
				}
			});

			$(window).trigger('action:reconnected');

			setTimeout(function() {
				reconnectEl.removeClass('active').addClass("hide");
			}, 3000);
		}
	}

	function onConfigLoad(data) {
		config = data;

		exposeConfigToTemplates();

		if(socket) {
			socket.disconnect();
			setTimeout(function() {
				socket.socket.connect();
			}, 200);
		} else {
			var ioParams = {
				'max reconnection attempts': config.maxReconnectionAttempts,
				'reconnection delay': config.reconnectionDelay,
				resource: RELATIVE_PATH.length ? RELATIVE_PATH.slice(1) + '/socket.io' : 'socket.io'
			};

			if (utils.isAndroidBrowser()) {
				ioParams.transports = ['xhr-polling'];
			}

			socket = io.connect(config.websocketAddress, ioParams);
			reconnecting = false;

			socket.on('event:connect', function (data) {
				app.username = data.username;
				app.userslug = data.userslug;
				app.uid = data.uid;
				app.isAdmin = data.isAdmin;

				templates.setGlobal('loggedIn', parseInt(data.uid, 10) !== 0);

				app.showLoginMessage();
				app.replaceSelfLinks();
				$(window).trigger('action:connected');
			});

			socket.on('event:alert', function (data) {
				app.alert(data);
			});

			socket.on('connect', onSocketConnect);

			socket.on('event:disconnect', function() {
				$(window).trigger('action:disconnected');
				socket.socket.connect();
			});

			socket.on('reconnecting', function (data, attempt) {
				if(attempt === parseInt(config.maxReconnectionAttempts, 10)) {
					socket.socket.reconnectionAttempts = 0;
					socket.socket.reconnectionDelay = config.reconnectionDelay;
					return;
				}

				reconnecting = true;
				var reconnectEl = $('#reconnect');

				if (!reconnectEl.hasClass('active')) {
					reconnectEl.html('<i class="fa fa-spinner fa-spin"></i>');
				}

				reconnectEl.addClass('active').removeClass("hide").tooltip({
					placement: 'bottom'
				});
			});

			socket.on('event:banned', function() {
				app.alert({
					title: '[[global:alert.banned]]',
					message: '[[global:alert.banned.message]]',
					type: 'danger',
					timeout: 1000
				});

				setTimeout(function() {
					window.location.href = RELATIVE_PATH + '/';
				}, 1000);
			});

			app.enterRoom('global');

			app.cacheBuster = config['cache-buster'];

			bootbox.setDefaults({
				locale: config.defaultLang
			});
		}
	}

	app.loadConfig = function() {
		$.ajax({
			url: RELATIVE_PATH + '/api/config',
			success: onConfigLoad,
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

	app.alert = function (params) {
		require(['alerts'], function(alerts) {
			alerts.alert(params);
		});
	};

	app.removeAlert = function(id) {
		require(['alerts'], function(alerts) {
			alerts.remove(id);
		});
	};

	app.alertSuccess = function (message, timeout) {
		app.alert({
			title: '[[global:alert.success]]',
			message: message,
			type: 'success',
			timeout: timeout ? timeout : 2000
		});
	};

	app.alertError = function (message, timeout) {
		app.alert({
			title: '[[global:alert.error]]',
			message: message,
			type: 'danger',
			timeout: timeout ? timeout : 2000
		});
	};

	app.enterRoom = function (room, force) {
		if (socket) {
			if (app.currentRoom === room && !force) {
				return;
			}

			socket.emit('meta.rooms.enter', {
				'enter': room,
				'leave': app.currentRoom
			});

			app.currentRoom = room;
		}
	};

	function highlightNavigationLink() {
		var path = window.location.pathname,
			parts = path.split('/'),
			active = parts[parts.length - 1];

		$('#main-nav li').removeClass('active');
		if (active) {
			$('#main-nav li a').each(function () {
				var href = $(this).attr('href');
				if (active === "sort-posts" || active === "sort-reputation" || active === "search" || active === "latest" || active === "online") {
					active = 'users';
				}

				if (href && href.match(active)) {
					$(this.parentNode).addClass('active');
					return false;
				}
			});
		}
	}

	app.createUserTooltips = function() {
		$('img[title].teaser-pic,img[title].user-img').each(function() {
			$(this).tooltip({
				placement: 'top',
				title: $(this).attr('title')
			});
		});
	};

	app.createStatusTooltips = function() {
		$('body').tooltip({
			selector:'.fa-circle.status',
			placement: 'top'
		});
	};

	app.replaceSelfLinks = function(selector) {
		selector = selector || $('a');
		selector.each(function() {
			var href = $(this).attr('href');
			if (href && app.userslug) {
				$(this).attr('href', href.replace(/\[self\]/g, app.userslug));
			}
		});
	};

	app.processPage = function () {
		highlightNavigationLink();

		$('span.timeago').timeago();

		utils.makeNumbersHumanReadable($('.human-readable-number'));

		utils.addCommasToNumbers($('.formatted-number'));

		app.createUserTooltips();

		app.createStatusTooltips();

		app.replaceSelfLinks();

		setTimeout(function () {
			window.scrollTo(0, 1); // rehide address bar on mobile after page load completes.
		}, 100);
	};

	app.showLoginMessage = function () {
		function showAlert() {
			app.alert({
				type: 'success',
				title: '[[global:welcome_back]] ' + app.username + '!',
				message: '[[global:you_have_successfully_logged_in]]',
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

	app.openChat = function (username, touid) {
		if (username === app.username) {
			return app.alertError('[[error:cant-chat-with-yourself]]');
		}

		if (!app.uid) {
			return app.alertError('[[error:not-logged-in]]');
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

	var	titleObj = {
			active: false,
			interval: undefined,
			titles: []
		};

	app.alternatingTitle = function (title) {
		if (typeof title !== 'string') {
			return;
		}

		if (title.length > 0 && !app.isFocused) {
			if (!titleObj.titles[0]) {
				titleObj.titles[0] = window.document.title;
			}

			translator.translate(title, function(translated) {
				titleObj.titles[1] = translated;
				if (titleObj.interval) {
					clearInterval(titleObj.interval);
				}

				titleObj.interval = setInterval(function() {
					var title = titleObj.titles[titleObj.titles.indexOf(window.document.title) ^ 1];
					if (title) {
						window.document.title = title;
					}
				}, 2000);
			});
		} else {
			if (titleObj.interval) {
				clearInterval(titleObj.interval);
			}
			if (titleObj.titles[0]) {
				window.document.title = titleObj.titles[0];
			}
		}
	};

	app.refreshTitle = function(url) {
		if (!url) {
			var a = document.createElement('a');
			a.href = document.location;
			url = a.pathname.slice(1);
		}

		socket.emit('meta.buildTitle', url, function(err, title, numNotifications) {
			titleObj.titles[0] = (numNotifications > 0 ? '(' + numNotifications + ') ' : '') + title;
			app.alternatingTitle('');
		});
	};

	function updateOnlineStatus(uid) {
		socket.emit('user.isOnline', uid, function(err, data) {
			$('#logged-in-menu #user_label #user-profile-link>i').attr('class', 'fa fa-circle status ' + data.status);
		});
	}

	function exposeConfigToTemplates() {
		$(document).ready(function() {
			templates.setGlobal('relative_path', RELATIVE_PATH);
			for(var key in config) {
				if (config.hasOwnProperty(key)) {
					templates.setGlobal('config.' + key, config[key]);
				}
			}
		});
	}

	function createHeaderTooltips() {
		if (utils.findBootstrapEnvironment() === 'xs') {
			return;
		}
		$('#header-menu li [title]').each(function() {
			$(this).tooltip({
				placement: 'bottom',
				title: $(this).attr('title')
			});
		});

		$('#search-form').parent().tooltip({
			placement: 'bottom',
			title: $('#search-button i').attr('title')
		});

		$('#user_dropdown').tooltip({
			placement: 'bottom',
			title: $('#user_dropdown').attr('title')
		});
	}

	function handleSearch() {
		var searchButton = $("#search-button"),
			searchFields = $("#search-fields"),
			searchInput = $('#search-fields input');

		function dismissSearch(){
			searchFields.hide();
			searchButton.show();
		}

		searchButton.on('click', function(e) {
			if (!config.loggedIn && !config.allowGuestSearching) {
				app.alert({
					message:'[[error:search-requires-login]]',
					timeout: 3000
				});
				ajaxify.go('login');
				return false;
			}
			e.stopPropagation();

			searchFields.removeClass('hide').show();
			$(this).hide();

			searchInput.focus();

			$('#search-form').on('submit', dismissSearch);
			searchInput.on('blur', dismissSearch);
			return false;
		});

		$('#search-form').on('submit', function () {
			var input = $(this).find('input');
			ajaxify.go('search/' + input.val().replace(/^[ ?#]*/, ''));
			input.val('');
			return false;
		});
	}

	function collapseNavigationOnClick() {
		$('#main-nav a, #user-control-list a, #logged-out-menu li a, #logged-in-menu .visible-xs').off('click').on('click', function() {
			if($('.navbar .navbar-collapse').hasClass('in')) {
				$('.navbar-header button').click();
			}
		});
	}

	function handleStatusChange() {
		$('#user-control-list .user-status').off('click').on('click', function(e) {
			socket.emit('user.setStatus', $(this).attr('data-status'), function(err, data) {
				if(err) {
					return app.alertError(err.message);
				}
				updateOnlineStatus(data.uid);
			});
			e.preventDefault();
		});
	}

	app.load = function() {
		$('document').ready(function () {
			var url = ajaxify.removeRelativePath(window.location.pathname.slice(1).replace(/\/$/, "")),
				tpl_url = ajaxify.getTemplateMapping(url),
				search = window.location.search,
				hash = window.location.hash,
				$window = $(window);


			$window.trigger('action:ajaxify.start', {
				url: url
			});

			collapseNavigationOnClick();

			handleStatusChange();

			handleSearch();

			$('#logout-link').on('click', app.logout);

			$window.blur(function(){
				app.isFocused = false;
			});

			$window.focus(function(){
				app.isFocused = true;
				app.alternatingTitle('');
			});

			createHeaderTooltips();
			ajaxify.variables.parse();
			ajaxify.currentPage = url;

			$window.trigger('action:ajaxify.contentLoaded', {
				url: url
			});

			if (window.history && window.history.replaceState) {
				window.history.replaceState({
					url: url + search + hash
				}, url, RELATIVE_PATH + '/' + url + search + hash);
			}

			ajaxify.loadScript(tpl_url, function() {
				ajaxify.widgets.render(tpl_url, url, function() {
					app.processPage();
					$window.trigger('action:ajaxify.end', {
						url: url
					});
				});
			});
		});
	};

	showWelcomeMessage = window.location.href.indexOf('loggedin') !== -1;

	app.loadConfig();
	app.alternatingTitle('');

}());
