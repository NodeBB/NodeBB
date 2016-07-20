"use strict";
/*global templates, ajaxify, utils, bootbox, overrides, socket, config, Visibility*/

var app = app || {};

app.isFocused = true;
app.currentRoom = null;
app.widgets = {};
app.cacheBuster = null;

(function () {
	var showWelcomeMessage = !!utils.params().loggedin;

	templates.setGlobal('config', config);

	app.cacheBuster = config['cache-buster'];

	bootbox.setDefaults({
		locale: config.userLang
	});

	app.load = function() {
		app.loadProgressiveStylesheet();

		var url = ajaxify.start(window.location.pathname.slice(1) + window.location.search + window.location.hash);
		ajaxify.updateHistory(url, true);
		ajaxify.end(url, app.template);

		handleStatusChange();

		if (config.searchEnabled) {
			app.handleSearch();
		}

		$('#content').on('click', '#new_topic', function(){
			app.newTopic();
		});

		require(['components'], function(components) {
			components.get('user/logout').on('click', app.logout);
		});

		Visibility.change(function(e, state){
			if (state === 'visible') {
				app.isFocused = true;
				app.alternatingTitle('');
			} else if (state === 'hidden') {
				app.isFocused = false;
			}
		});

		overrides.overrideBootbox();
		overrides.overrideTimeago();
		createHeaderTooltips();
		app.showEmailConfirmWarning();

		socket.removeAllListeners('event:nodebb.ready');
		socket.on('event:nodebb.ready', function(data) {
			if (!app.cacheBuster || app.cacheBuster !== data['cache-buster']) {
				app.cacheBuster = data['cache-buster'];

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

		require(['taskbar', 'helpers', 'forum/pagination'], function(taskbar, helpers, pagination) {
			taskbar.init();

			// templates.js helpers
			helpers.register();

			pagination.init();

			$(window).trigger('action:app.load');
		});
	};

	app.logout = function() {
		$.ajax(config.relative_path + '/logout', {
			type: 'POST',
			headers: {
				'x-csrf-token': config.csrf_token
			},
			success: function() {
				window.location.href = config.relative_path + '/';
			}
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
			timeout: timeout ? timeout : 5000
		});
	};

	app.alertError = function (message, timeout) {
		app.alert({
			title: '[[global:alert.error]]',
			message: message,
			type: 'danger',
			timeout: timeout ? timeout : 10000
		});
	};

	app.enterRoom = function (room, callback) {
		callback = callback || function() {};
		if (socket && app.user.uid && app.currentRoom !== room) {
			var previousRoom = app.currentRoom;
			app.currentRoom = room;
			socket.emit('meta.rooms.enter', {
				enter: room
			}, function(err) {
				if (err) {
					app.currentRoom = previousRoom;
					return app.alertError(err.message);
				}

				callback();
			});
		}
	};

	app.leaveCurrentRoom = function() {
		if (!socket) {
			return;
		}
		socket.emit('meta.rooms.leaveCurrent', function(err) {
			if (err) {
				return app.alertError(err.message);
			}
			app.currentRoom = '';
		});
	};

	function highlightNavigationLink() {
		var path = window.location.pathname;
		$('#main-nav li').removeClass('active');
		if (path) {
			$('#main-nav li').removeClass('active').find('a[href="' + path + '"]').parent().addClass('active');
		}
	}

	app.createUserTooltips = function(els) {
		els = els || $('body');
		els.find('.avatar,img[title].teaser-pic,img[title].user-img,div.user-icon,span.user-icon').each(function() {
			if (!utils.isTouchDevice()) {
				$(this).tooltip({
					placement: 'top',
					title: $(this).attr('title')
				});
			}
		});
	};

	app.createStatusTooltips = function() {
		if (!utils.isTouchDevice()) {
			$('body').tooltip({
				selector:'.fa-circle.status',
				placement: 'top'
			});
		}
	};

	app.replaceSelfLinks = function(selector) {
		selector = selector || $('a');
		selector.each(function() {
			var href = $(this).attr('href');
			if (href && app.user.userslug && href.indexOf('user/_self_') !== -1) {
				$(this).attr('href', href.replace(/user\/_self_/g, 'user/' + app.user.userslug));
			}
		});
	};

	app.processPage = function () {
		highlightNavigationLink();

		$('.timeago').timeago();

		utils.makeNumbersHumanReadable($('.human-readable-number'));

		utils.addCommasToNumbers($('.formatted-number'));

		app.createUserTooltips();

		app.createStatusTooltips();

		app.replaceSelfLinks();

		// Scroll back to top of page
		window.scrollTo(0, 0);
	};

	app.showLoginMessage = function () {
		function showAlert() {
			app.alert({
				type: 'success',
				title: '[[global:welcome_back]] ' + app.user.username + '!',
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

	app.openChat = function (roomId) {
		if (!app.user.uid) {
			return app.alertError('[[error:not-logged-in]]');
		}

		require(['chat'], function (chat) {
			function loadAndCenter(chatModal) {
				chat.load(chatModal.attr('UUID'));
				chat.center(chatModal);
				chat.focusInput(chatModal);
			}

			if (chat.modalExists(roomId)) {
				loadAndCenter(chat.getModal(roomId));
			} else {
				socket.emit('modules.chats.loadRoom', {roomId: roomId}, function(err, roomData) {
					if (err) {
						return app.alertError(err.message);
					}
					roomData.users = roomData.users.filter(function(user) {
						return user && parseInt(user.uid, 10) !== parseInt(app.user.uid, 10);
					});
					chat.createModal(roomData, loadAndCenter);
				});
			}
		});
	};

	app.newChat = function (touid) {
		if (!app.user.uid) {
			return app.alertError('[[error:not-logged-in]]');
		}

		socket.emit('modules.chats.newRoom', {touid: touid}, function(err, roomId) {
			if (err) {
				return app.alertError(err.message);
			}
			if (!ajaxify.currentPage.startsWith('chats')) {
				app.openChat(roomId);
			} else {
				ajaxify.go('chats/' + roomId);
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

			require(['translator'], function(translator) {
				translator.translate(title, function(translated) {
					titleObj.titles[1] = translated;
					if (titleObj.interval) {
						clearInterval(titleObj.interval);
					}

					titleObj.interval = setInterval(function() {
						var title = titleObj.titles[titleObj.titles.indexOf(window.document.title) ^ 1];
						if (title) {
							window.document.title = $('<div/>').html(title).text();
						}
					}, 2000);
				});
			});
		} else {
			if (titleObj.interval) {
				clearInterval(titleObj.interval);
			}
			if (titleObj.titles[0]) {
				window.document.title = $('<div/>').html(titleObj.titles[0]).text();
			}
		}
	};

	app.refreshTitle = function(title) {
		if (!title) {
			return;
		}
		require(['translator'], function(translator) {
			title = config.titleLayout.replace(/&#123;/g, '{').replace(/&#125;/g, '}')
				.replace('{pageTitle}', function() { return title; })
				.replace('{browserTitle}', function() { return config.browserTitle; });

			translator.translate(title, function(translated) {
				titleObj.titles[0] = translated;
				app.alternatingTitle('');
			});
		});
	};

	app.toggleNavbar = function(state) {
		var navbarEl = $('.navbar');
		if (navbarEl) {
			navbarEl.toggleClass('hidden', !!!state);
		}
	};

	function createHeaderTooltips() {
		var env = utils.findBootstrapEnvironment();
		if (env === 'xs' || env === 'sm') {
			return;
		}
		$('#header-menu li a[title]').each(function() {
			if (!utils.isTouchDevice()) {
				$(this).tooltip({
					placement: 'bottom',
					trigger: 'hover',
					title: $(this).attr('title')
				});
			}
		});

		if (!utils.isTouchDevice()) {
			$('#search-form').parent().tooltip({
				placement: 'bottom',
				trigger: 'hover',
				title: $('#search-button i').attr('title')
			});
		}

		if (!utils.isTouchDevice()) {
			$('#user_dropdown').tooltip({
				placement: 'bottom',
				trigger: 'hover',
				title: $('#user_dropdown').attr('title')
			});
		}
	}

	app.handleSearch = function () {
		var searchButton = $("#search-button"),
			searchFields = $("#search-fields"),
			searchInput = $('#search-fields input');

		$('#search-form .advanced-search-link').on('mousedown', function() {
			ajaxify.go('/search');
		});

		$('#search-form').on('submit', dismissSearch);
		searchInput.on('blur', dismissSearch);

		function dismissSearch(){
			searchFields.addClass('hidden');
			searchButton.removeClass('hidden');
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

			app.prepareSearch();
			return false;
		});

		$('#search-form').on('submit', function () {
			var input = $(this).find('input');
			require(['search'], function(search) {
				search.query({term: input.val()}, function() {
					input.val('');
				});
			});
			return false;
		});
	};

	app.prepareSearch = function() {
		$("#search-fields").removeClass('hidden');
		$("#search-button").addClass('hidden');
		$('#search-fields input').focus();
	};

	function handleStatusChange() {
		$('[component="header/usercontrol"] [data-status]').off('click').on('click', function(e) {
			var status = $(this).attr('data-status');
			socket.emit('user.setStatus', status, function(err) {
				if(err) {
					return app.alertError(err.message);
				}
				$('[data-uid="' + app.user.uid + '"] [component="user/status"], [component="header/profilelink"] [component="user/status"]')
					.removeClass('away online dnd offline')
					.addClass(status);

				app.user.status = status;
			});
			e.preventDefault();
		});
	}

	app.updateUserStatus = function(el, status) {
		if (!el.length) {
			return;
		}

		require(['translator'], function(translator) {
			translator.translate('[[global:' + status + ']]', function(translated) {
				el.removeClass('online offline dnd away')
					.addClass(status)
					.attr('title', translated)
					.attr('data-original-title', translated);
			});
		});
	};

	app.newTopic = function (cid) {
		$(window).trigger('action:composer.topic.new', {
			cid: cid || ajaxify.data.cid || 0
		});
	};

	app.loadJQueryUI = function(callback) {
		if (typeof $().autocomplete === 'function') {
			return callback();
		}

		$.getScript(config.relative_path + '/vendor/jquery/js/jquery-ui-1.10.4.custom.js', callback);
	};

	app.showEmailConfirmWarning = function(err) {
		if (!config.requireEmailConfirmation || !app.user.uid) {
			return;
		}
		if (!app.user.email) {
			app.alert({
				alert_id: 'email_confirm',
				message: '[[error:no-email-to-confirm]]',
				type: 'warning',
				timeout: 0,
				clickfn: function() {
					app.removeAlert('email_confirm');
					ajaxify.go('user/' + app.user.userslug + '/edit');
				}
			});
		} else if (!app.user['email:confirmed']) {
			app.alert({
				alert_id: 'email_confirm',
				message: err ? err.message : '[[error:email-not-confirmed]]',
				type: 'warning',
				timeout: 0,
				clickfn: function() {
					app.removeAlert('email_confirm');
					socket.emit('user.emailConfirm', {}, function(err) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('[[notifications:email-confirm-sent]]');
					});
				}
			});
		}
	};

	app.parseAndTranslate = function(template, blockName, data, callback) {
		require(['translator'], function(translator) {
			if (typeof blockName === 'string') {
				templates.parse(template, blockName, data, function(html) {
					translator.translate(html, function(translatedHTML) {
						translatedHTML = translator.unescape(translatedHTML);
						callback($(translatedHTML));
					});
				});
			} else {
				callback = data, data = blockName;
				templates.parse(template, data, function(html) {
					translator.translate(html, function(translatedHTML) {
						translatedHTML = translator.unescape(translatedHTML);
						callback($(translatedHTML));
					});
				});
			}
		});
	};

	app.loadProgressiveStylesheet = function() {
		var linkEl = document.createElement('link');
		linkEl.rel = 'stylesheet';
		linkEl.href = config.relative_path + '/js-enabled.css';

		document.head.appendChild(linkEl);
	};
}());
