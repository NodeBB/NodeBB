'use strict';


app = window.app || {};

app.isFocused = true;
app.currentRoom = null;
app.widgets = {};
app.flags = {};
app.cacheBuster = null;

(function () {
	var params = utils.params();
	var showWelcomeMessage = !!params.loggedin;
	var registerMessage = params.register;
	var isTouchDevice = utils.isTouchDevice();

	app.cacheBuster = config['cache-buster'];

	/**
	 * Occasionally, a button or anchor (not meant to be ajaxified) is clicked before
	 * ajaxify is ready. Capture that event and re-click it once NodeBB is ready.
	 *
	 * e.g. New Topic/Reply, post tools
	 */
	var earlyQueue = [];	// once we can ES6, use Set instead
	var earlyClick = function (ev) {
		var btnEl = ev.target.closest('button');
		if (!btnEl && ev.target.closest('a') && ev.target.closest('a').getAttribute('data-ajaxify') === 'false') {
			btnEl = ev.target.closest('a');
		}
		if (btnEl && !earlyQueue.includes(btnEl)) {
			earlyQueue.push(btnEl);
			ev.stopImmediatePropagation();
			ev.preventDefault();
		}
	};
	document.body.addEventListener('click', earlyClick);
	$(window).on('action:ajaxify.end', function () {
		document.body.removeEventListener('click', earlyClick);
		earlyQueue.forEach(function (el) {
			el.click();
		});
	});

	bootbox.setDefaults({
		locale: config.userLang,
	});

	$(document).ready(function () {
		ajaxify.parseData();
		app.load();
	});

	app.load = function () {
		overrides.overrideTimeago();

		handleStatusChange();

		if (config.searchEnabled) {
			app.handleSearch();
		}

		$('body').on('click', '#new_topic', function (e) {
			e.preventDefault();
			app.newTopic();
		});

		$('#header-menu .container').on('click', '[component="user/logout"]', function () {
			app.logout();
			return false;
		});

		Visibility.change(function (event, state) {
			app.isFocused = state === 'visible';
		});

		createHeaderTooltips();
		app.showEmailConfirmWarning();
		app.showCookieWarning();
		registerServiceWorker();

		require(['taskbar', 'helpers', 'forum/pagination'], function (taskbar, helpers, pagination) {
			taskbar.init();

			helpers.register();

			pagination.init();

			$(window).trigger('action:app.load');
		});
	};

	app.logout = function (redirect) {
		redirect = redirect === undefined ? true : redirect;
		$(window).trigger('action:app.logout');

		$.ajax(config.relative_path + '/logout', {
			type: 'POST',
			headers: {
				'x-csrf-token': config.csrf_token,
			},
			beforeSend: function () {
				app.flags._logout = true;
			},
			success: function (data) {
				$(window).trigger('action:app.loggedOut', data);
				if (redirect) {
					if (data.next) {
						window.location.href = data.next;
					} else {
						window.location.reload();
					}
				}
			},
		});
		return false;
	};

	app.alert = function (params) {
		require(['alerts'], function (alerts) {
			alerts.alert(params);
		});
	};

	app.removeAlert = function (id) {
		require(['alerts'], function (alerts) {
			alerts.remove(id);
		});
	};

	app.alertSuccess = function (message, timeout) {
		app.alert({
			alert_id: utils.generateUUID(),
			title: '[[global:alert.success]]',
			message: message,
			type: 'success',
			timeout: timeout || 5000,
		});
	};

	app.alertError = function (message, timeout) {
		message = message.message || message;

		if (message === '[[error:invalid-session]]') {
			app.logout(false);
			return app.handleInvalidSession();
		}

		app.alert({
			alert_id: utils.generateUUID(),
			title: '[[global:alert.error]]',
			message: message,
			type: 'danger',
			timeout: timeout || 10000,
		});
	};

	app.handleInvalidSession = function () {
		if (app.flags._logout) {
			return;
		}

		socket.disconnect();
		bootbox.alert({
			title: '[[error:invalid-session]]',
			message: '[[error:invalid-session-text]]',
			closeButton: false,
			callback: function () {
				window.location.reload();
			},
		});
	};

	app.enterRoom = function (room, callback) {
		callback = callback || function () { };
		if (socket && app.user.uid && app.currentRoom !== room) {
			var previousRoom = app.currentRoom;
			app.currentRoom = room;
			socket.emit('meta.rooms.enter', {
				enter: room,
			}, function (err) {
				if (err) {
					app.currentRoom = previousRoom;
					return app.alertError(err.message);
				}

				callback();
			});
		}
	};

	app.leaveCurrentRoom = function () {
		if (!socket) {
			return;
		}
		var previousRoom = app.currentRoom;
		app.currentRoom = '';
		socket.emit('meta.rooms.leaveCurrent', function (err) {
			if (err) {
				app.currentRoom = previousRoom;
				return app.alertError(err.message);
			}
		});
	};

	function highlightNavigationLink() {
		$('#main-nav li')
			.removeClass('active')
			.find('a')
			.filter(function (i, x) { return window.location.pathname.startsWith(x.getAttribute('href')); })
			.parent()
			.addClass('active');
	}

	app.createUserTooltips = function (els, placement) {
		if (isTouchDevice) {
			return;
		}
		els = els || $('body');
		els.find('.avatar,img[title].teaser-pic,img[title].user-img,div.user-icon,span.user-icon').each(function () {
			$(this).tooltip({
				placement: placement || $(this).attr('title-placement') || 'top',
				title: $(this).attr('title'),
				container: '#content',
			});
		});
	};

	app.createStatusTooltips = function () {
		if (!isTouchDevice) {
			$('body').tooltip({
				selector: '.fa-circle.status',
				placement: 'top',
			});
		}
	};

	app.processPage = function () {
		highlightNavigationLink();

		$('.timeago').timeago();

		utils.makeNumbersHumanReadable($('.human-readable-number'));

		utils.addCommasToNumbers($('.formatted-number'));

		app.createUserTooltips($('#content'));

		app.createStatusTooltips();

		// Scroll back to top of page
		if (!ajaxify.isCold()) {
			window.scrollTo(0, 0);
		}
	};

	app.showMessages = function () {
		var messages = {
			login: {
				format: 'alert',
				title: '[[global:welcome_back]] ' + app.user.username + '!',
				message: '[[global:you_have_successfully_logged_in]]',
			},
			register: {
				format: 'modal',
			},
		};

		function showAlert(type, message) {
			switch (messages[type].format) {
				case 'alert':
					app.alert({
						type: 'success',
						title: messages[type].title,
						message: messages[type].message,
						timeout: 5000,
					});
					break;

				case 'modal':
					require(['translator'], function (translator) {
						translator.translate(message || messages[type].message, function (translated) {
							bootbox.alert({
								title: messages[type].title,
								message: translated,
							});
						});
					});
					break;
			}
		}

		if (showWelcomeMessage) {
			showWelcomeMessage = false;
			$(document).ready(function () {
				showAlert('login');
			});
		}
		if (registerMessage) {
			$(document).ready(function () {
				showAlert('register', utils.escapeHTML(decodeURIComponent(registerMessage)));
				registerMessage = false;
			});
		}
	};

	app.openChat = function (roomId, uid) {
		if (!app.user.uid) {
			return app.alertError('[[error:not-logged-in]]');
		}

		require(['chat'], function (chat) {
			function loadAndCenter(chatModal) {
				chat.load(chatModal.attr('data-uuid'));
				chat.center(chatModal);
				chat.focusInput(chatModal);
			}

			if (chat.modalExists(roomId)) {
				loadAndCenter(chat.getModal(roomId));
			} else {
				socket.emit('modules.chats.loadRoom', { roomId: roomId, uid: uid || app.user.uid }, function (err, roomData) {
					if (err) {
						return app.alertError(err.message);
					}
					roomData.users = roomData.users.filter(function (user) {
						return user && parseInt(user.uid, 10) !== parseInt(app.user.uid, 10);
					});
					roomData.uid = uid || app.user.uid;
					roomData.isSelf = true;
					chat.createModal(roomData, loadAndCenter);
				});
			}
		});
	};

	app.newChat = function (touid, callback) {
		function createChat() {
			socket.emit('modules.chats.newRoom', { touid: touid }, function (err, roomId) {
				if (err) {
					return app.alertError(err.message);
				}

				if (!ajaxify.data.template.chats) {
					app.openChat(roomId);
				} else {
					ajaxify.go('chats/' + roomId);
				}

				callback(false, roomId);
			});
		}

		callback = callback || function () { };
		if (!app.user.uid) {
			return app.alertError('[[error:not-logged-in]]');
		}

		if (parseInt(touid, 10) === parseInt(app.user.uid, 10)) {
			return app.alertError('[[error:cant-chat-with-yourself]]');
		}
		socket.emit('modules.chats.isDnD', touid, function (err, isDnD) {
			if (err) {
				return app.alertError(err.message);
			}
			if (!isDnD) {
				return createChat();
			}
			bootbox.confirm('[[modules:chat.confirm-chat-with-dnd-user]]', function (ok) {
				if (ok) {
					createChat();
				}
			});
		});
	};

	app.toggleNavbar = function (state) {
		var navbarEl = $('.navbar');
		if (navbarEl) {
			navbarEl[state ? 'show' : 'hide']();
		}
	};

	function createHeaderTooltips() {
		var env = utils.findBootstrapEnvironment();
		if (env === 'xs' || env === 'sm' || isTouchDevice) {
			return;
		}
		$('#header-menu li a[title]').each(function () {
			$(this).tooltip({
				placement: 'bottom',
				trigger: 'hover',
				title: $(this).attr('title'),
			});
		});


		$('#search-form').tooltip({
			placement: 'bottom',
			trigger: 'hover',
			title: $('#search-button i').attr('title'),
		});


		$('#user_dropdown').tooltip({
			placement: 'bottom',
			trigger: 'hover',
			title: $('#user_dropdown').attr('title'),
		});
	}

	app.enableTopicSearch = function (options) {
		/* eslint-disable-next-line */
		var searchOptions = Object.assign({ in: 'titles' }, options.searchOptions);
		var quickSearchResults = options.searchElements.resultEl;
		var inputEl = options.searchElements.inputEl;
		var searchTimeoutId = 0;
		var oldValue = inputEl.val();

		function doSearch() {
			require(['search'], function (search) {
				/* eslint-disable-next-line */
				options.searchOptions = Object.assign({}, searchOptions);
				options.searchOptions.term = inputEl.val();
				quickSearchResults.removeClass('hidden').find('.quick-search-results-container').html('');
				quickSearchResults.find('.loading-indicator').removeClass('hidden');
				$(window).trigger('action:search.quick.start', options);
				options.searchOptions.searchOnly = 1;
				search.api(options.searchOptions, function (data) {
					quickSearchResults.find('.loading-indicator').addClass('hidden');
					if (options.hideOnNoMatches && !data.posts.length) {
						return quickSearchResults.addClass('hidden').find('.quick-search-results-container').html('');
					}
					data.posts.forEach(function (p) {
						var text = $('<div>' + p.content + '</div>').text();
						var start = Math.max(0, text.toLowerCase().indexOf(inputEl.val().toLowerCase()) - 40);
						p.snippet = utils.escapeHTML((start > 0 ? '...' : '') +
							text.slice(start, start + 80) +
							(text.length - start > 80 ? '...' : ''));
					});
					app.parseAndTranslate('partials/quick-search-results', data, function (html) {
						if (html.length) {
							html.find('.timeago').timeago();
						}
						quickSearchResults.toggleClass('hidden', !html.length || !inputEl.is(':focus'))
							.find('.quick-search-results-container')
							.html(html.length ? html : '');
						var highlightEls = quickSearchResults.find(
							'.quick-search-results .quick-search-title, .quick-search-results .snippet'
						);
						search.highlightMatches(options.searchOptions.term, highlightEls);
						$(window).trigger('action:search.quick.complete', {
							data: data,
							options: options,
						});
					});
				});
			});
		}

		inputEl.off('keyup').on('keyup', function () {
			if (searchTimeoutId) {
				clearTimeout(searchTimeoutId);
				searchTimeoutId = 0;
			}
			searchTimeoutId = setTimeout(function () {
				if (inputEl.val().length < 3) {
					quickSearchResults.addClass('hidden');
					oldValue = inputEl.val();
					return;
				}
				if (inputEl.val() === oldValue) {
					return;
				}
				oldValue = inputEl.val();
				if (!inputEl.is(':focus')) {
					return quickSearchResults.addClass('hidden');
				}
				doSearch();
			}, 250);
		});

		inputEl.on('blur', function () {
			setTimeout(function () {
				if (!inputEl.is(':focus')) {
					quickSearchResults.addClass('hidden');
				}
			}, 200);
		});

		inputEl.on('focus', function () {
			oldValue = inputEl.val();
			if (inputEl.val() && quickSearchResults.find('#quick-search-results').children().length) {
				quickSearchResults.removeClass('hidden');
			}
		});

		inputEl.off('refresh').on('refresh', function () {
			doSearch();
		});
	};

	app.handleSearch = function (searchOptions) {
		searchOptions = searchOptions || { in: 'titles' };
		var searchButton = $('#search-button');
		var searchFields = $('#search-fields');
		var searchInput = $('#search-fields input');
		var quickSearchContainer = $('#quick-search-container');

		$('#search-form .advanced-search-link').off('mousedown').on('mousedown', function () {
			ajaxify.go('/search');
		});

		$('#search-form').off('submit').on('submit', function () {
			searchInput.blur();
		});
		searchInput.off('blur').on('blur', dismissSearch);
		searchInput.off('focus');

		var searchElements = {
			inputEl: searchInput,
			resultEl: quickSearchContainer,
		};

		app.enableTopicSearch({
			searchOptions: searchOptions,
			searchElements: searchElements,
		});

		function dismissSearch() {
			searchFields.addClass('hidden');
			searchButton.removeClass('hidden');
		}

		searchButton.off('click').on('click', function (e) {
			if (!config.loggedIn && !app.user.privileges['search:content']) {
				app.alert({
					message: '[[error:search-requires-login]]',
					timeout: 3000,
				});
				ajaxify.go('login');
				return false;
			}
			e.stopPropagation();

			app.prepareSearch();
			return false;
		});

		$('#search-form').off('submit').on('submit', function () {
			var input = $(this).find('input');
			require(['search'], function (search) {
				var data = search.getSearchPreferences();
				data.term = input.val();
				$(window).trigger('action:search.submit', {
					searchOptions: data,
					searchElements: searchElements,
				});
				search.query(data, function () {
					input.val('');
				});
			});
			return false;
		});
	};

	app.prepareSearch = function () {
		$('#search-fields').removeClass('hidden');
		$('#search-button').addClass('hidden');
		$('#search-fields input').focus();
	};

	function handleStatusChange() {
		$('[component="header/usercontrol"] [data-status]').off('click').on('click', function (e) {
			var status = $(this).attr('data-status');
			socket.emit('user.setStatus', status, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				$('[data-uid="' + app.user.uid + '"] [component="user/status"], [component="header/profilelink"] [component="user/status"]')
					.removeClass('away online dnd offline')
					.addClass(status);
				$('[component="header/usercontrol"] [data-status]').each(function () {
					$(this).find('span').toggleClass('bold', $(this).attr('data-status') === status);
				});
				app.user.status = status;
			});
			e.preventDefault();
		});
	}

	app.updateUserStatus = function (el, status) {
		if (!el.length) {
			return;
		}

		require(['translator'], function (translator) {
			translator.translate('[[global:' + status + ']]', function (translated) {
				el.removeClass('online offline dnd away')
					.addClass(status)
					.attr('title', translated)
					.attr('data-original-title', translated);
			});
		});
	};

	app.newTopic = function (cid, tags) {
		$(window).trigger('action:composer.topic.new', {
			cid: cid || ajaxify.data.cid || 0,
			tags: tags || (ajaxify.data.tag ? [ajaxify.data.tag] : []),
		});
	};

	app.loadJQueryUI = function (callback) {
		if (typeof $().autocomplete === 'function') {
			return callback();
		}

		var scriptEl = document.createElement('script');
		scriptEl.type = 'text/javascript';
		scriptEl.src = config.relative_path + '/assets/vendor/jquery/js/jquery-ui.js?' + config['cache-buster'];
		scriptEl.onload = callback;
		document.head.appendChild(scriptEl);
	};

	app.showEmailConfirmWarning = function (err) {
		if (!config.requireEmailConfirmation || !app.user.uid) {
			return;
		}
		var msg = {
			alert_id: 'email_confirm',
			type: 'warning',
			timeout: 0,
		};

		if (!app.user.email) {
			msg.message = '[[error:no-email-to-confirm]]';
			msg.clickfn = function () {
				app.removeAlert('email_confirm');
				ajaxify.go('user/' + app.user.userslug + '/edit');
			};
			app.alert(msg);
		} else if (!app.user['email:confirmed'] && !app.user.isEmailConfirmSent) {
			msg.message = err ? err.message : '[[error:email-not-confirmed]]';
			msg.clickfn = function () {
				app.removeAlert('email_confirm');
				socket.emit('user.emailConfirm', {}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[notifications:email-confirm-sent]]');
				});
			};

			app.alert(msg);
		} else if (!app.user['email:confirmed'] && app.user.isEmailConfirmSent) {
			msg.message = '[[error:email-not-confirmed-email-sent]]';
			app.alert(msg);
		}
	};

	app.parseAndTranslate = function (template, blockName, data, callback) {
		require(['translator', 'benchpress'], function (translator, Benchpress) {
			function translate(html, callback) {
				translator.translate(html, function (translatedHTML) {
					translatedHTML = translator.unescape(translatedHTML);
					callback($(translatedHTML));
				});
			}

			if (typeof blockName === 'string') {
				Benchpress.parse(template, blockName, data, function (html) {
					translate(html, callback);
				});
			} else {
				callback = data;
				data = blockName;
				Benchpress.parse(template, data, function (html) {
					translate(html, callback);
				});
			}
		});
	};

	app.showCookieWarning = function () {
		require(['translator', 'storage'], function (translator, storage) {
			if (!config.cookies.enabled || !navigator.cookieEnabled) {
				// Skip warning if cookie consent subsystem disabled (obviously), or cookies not in use
				return;
			} else if (window.location.pathname.startsWith(config.relative_path + '/admin')) {
				// No need to show cookie consent warning in ACP
				return;
			} else if (storage.getItem('cookieconsent') === '1') {
				return;
			}

			config.cookies.message = translator.unescape(config.cookies.message);
			config.cookies.dismiss = translator.unescape(config.cookies.dismiss);
			config.cookies.link = translator.unescape(config.cookies.link);
			config.cookies.link_url = translator.unescape(config.cookies.link_url);

			app.parseAndTranslate('partials/cookie-consent', config.cookies, function (html) {
				$(document.body).append(html);
				$(document.body).addClass('cookie-consent-open');

				var warningEl = $('.cookie-consent');
				var dismissEl = warningEl.find('button');
				dismissEl.on('click', function () {
					// Save consent cookie and remove warning element
					storage.setItem('cookieconsent', '1');
					warningEl.remove();
					$(document.body).removeClass('cookie-consent-open');
				});
			});
		});
	};

	function registerServiceWorker() {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js')
				.then(function () {
					console.log('ServiceWorker registration succeeded.');
				}).catch(function (err) {
					console.log('ServiceWorker registration failed: ', err);
				});
		}
	}
}());
