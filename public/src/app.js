'use strict';


app = window.app || {};

app.isFocused = true;
app.currentRoom = null;
app.widgets = {};
app.flags = {};
app.cacheBuster = null;

(function () {
	let appLoaded = false;
	const isTouchDevice = utils.isTouchDevice();

	app.cacheBuster = config['cache-buster'];

	let hooks;
	require(['hooks'], function (_hooks) {
		hooks = _hooks;
	});

	$(document).ready(function () {
		ajaxify.parseData();
		app.load();
	});

	app.coldLoad = function () {
		if (appLoaded) {
			ajaxify.coldLoad();
		} else {
			$(window).on('action:app.load', function () {
				ajaxify.coldLoad();
			});
		}
	};

	app.handleEarlyClicks = function () {
		/**
		 * Occasionally, a button or anchor (not meant to be ajaxified) is clicked before
		 * ajaxify is ready. Capture that event and re-click it once NodeBB is ready.
		 *
		 * e.g. New Topic/Reply, post tools
		 */
		if (document.body) {
			let earlyQueue = [];	// once we can ES6, use Set instead
			const earlyClick = function (ev) {
				let btnEl = ev.target.closest('button');
				const anchorEl = ev.target.closest('a');
				if (!btnEl && anchorEl && (anchorEl.getAttribute('data-ajaxify') === 'false' || anchorEl.href === '#')) {
					btnEl = anchorEl;
				}
				if (btnEl && !earlyQueue.includes(btnEl)) {
					earlyQueue.push(btnEl);
					ev.stopImmediatePropagation();
					ev.preventDefault();
				}
			};
			document.body.addEventListener('click', earlyClick);
			require(['hooks'], function (hooks) {
				hooks.on('action:ajaxify.end', function () {
					document.body.removeEventListener('click', earlyClick);
					earlyQueue.forEach(function (el) {
						el.click();
					});
					earlyQueue = [];
				});
			});
		} else {
			setTimeout(app.handleEarlyClicks, 50);
		}
	};
	app.handleEarlyClicks();

	app.load = function () {
		handleStatusChange();

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

		registerServiceWorker();

		require([
			'taskbar',
			'helpers',
			'forum/pagination',
			'translator',
			'messages',
			'search',
			'forum/unread',
			'forum/header/notifications',
			'forum/header/chat',
			'timeago/jquery.timeago',
		], function (taskbar, helpers, pagination, translator, messages, search, unread, notifications, chat) {
			notifications.prepareDOM();
			chat.prepareDOM();
			translator.prepareDOM();
			taskbar.init();
			helpers.register();
			pagination.init();
			search.init();

			if (app.user.uid > 0) {
				unread.initUnreadTopics();
			}
			function finishLoad() {
				hooks.fire('action:app.load');
				messages.show();
				appLoaded = true;
			}
			overrides.overrideTimeago();
			if (app.user.timeagoCode && app.user.timeagoCode !== 'en') {
				require(['timeago/locales/jquery.timeago.' + app.user.timeagoCode], finishLoad);
			} else {
				finishLoad();
			}
		});
	};

	app.require = async (modules) => {	// allows you to await require.js modules
		let single = false;
		if (!Array.isArray(modules)) {
			modules = [modules];
			single = true;
		}

		return new Promise((resolve, reject) => {
			require(modules, (...exports) => {
				resolve(single ? exports.pop() : exports);
			}, reject);
		});
	};

	app.logout = function (redirect) {
		redirect = redirect === undefined ? true : redirect;
		hooks.fire('action:app.logout');

		$.ajax(config.relative_path + '/logout', {
			type: 'POST',
			headers: {
				'x-csrf-token': config.csrf_token,
			},
			beforeSend: function () {
				app.flags._logout = true;
			},
			success: function (data) {
				hooks.fire('action:app.loggedOut', data);
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
		message = (message && message.message) || message;

		if (message === '[[error:revalidate-failure]]') {
			socket.disconnect();
			app.reconnect();
			return;
		}

		app.alert({
			alert_id: utils.generateUUID(),
			title: '[[global:alert.error]]',
			message: message,
			type: 'danger',
			timeout: timeout || 10000,
		});
	};

	app.enterRoom = function (room, callback) {
		callback = callback || function () { };
		if (socket && app.user.uid && app.currentRoom !== room) {
			const previousRoom = app.currentRoom;
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
		if (!socket || config.maintenanceMode) {
			return;
		}
		const previousRoom = app.currentRoom;
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
			.filter(function (i, a) {
				return $(a).attr('href') !== '#' && window.location.hostname === a.hostname &&
					(
						window.location.pathname === a.pathname ||
						window.location.pathname.startsWith(a.pathname + '/')
					);
			})
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
			require(['bootbox'], function (bootbox) {
				bootbox.confirm('[[modules:chat.confirm-chat-with-dnd-user]]', function (ok) {
					if (ok) {
						createChat();
					}
				});
			});
		});
	};

	app.toggleNavbar = function (state) {
		require(['components'], (components) => {
			const navbarEl = components.get('navbar');
			navbarEl[state ? 'show' : 'hide']();
		});
	};

	function createHeaderTooltips() {
		const env = utils.findBootstrapEnvironment();
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
		console.warn('[deprecated] app.enableTopicSearch is deprecated, please use search.enableQuickSearch(options)');
		require(['search'], function (search) {
			search.enableQuickSearch(options);
		});
	};

	app.handleSearch = function (searchOptions) {
		console.warn('[deprecated] app.handleSearch is deprecated, please use search.init(options)');
		require(['search'], function (search) {
			search.init(searchOptions);
		});
	};

	app.prepareSearch = function () {
		console.warn('[deprecated] app.prepareSearch is deprecated, please use search.showAndFocusInput()');
		require(['search'], function (search) {
			search.showAndFocusInput();
		});
	};

	function handleStatusChange() {
		$('[component="header/usercontrol"] [data-status]').off('click').on('click', function (e) {
			const status = $(this).attr('data-status');
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
		hooks.fire('action:composer.topic.new', {
			cid: cid || ajaxify.data.cid || 0,
			tags: tags || (ajaxify.data.tag ? [ajaxify.data.tag] : []),
		});
	};

	app.loadJQueryUI = function (callback) {
		if (typeof $().autocomplete === 'function') {
			return callback();
		}
		require([
			'jquery-ui/widgets/datepicker',
			'jquery-ui/widgets/autocomplete',
			'jquery-ui/widgets/sortable',
			'jquery-ui/widgets/resizable',
			'jquery-ui/widgets/draggable',
		], function () {
			callback();
		});
	};

	app.parseAndTranslate = function (template, blockName, data, callback) {
		if (typeof blockName !== 'string') {
			callback = data;
			data = blockName;
			blockName = undefined;
		}

		return new Promise((resolve, reject) => {
			require(['translator', 'benchpress'], function (translator, Benchpress) {
				Benchpress.render(template, data, blockName)
					.then(rendered => translator.translate(rendered))
					.then(translated => translator.unescape(translated))
					.then(resolve, reject);
			});
		}).then((html) => {
			html = $(html);
			if (callback && typeof callback === 'function') {
				setTimeout(callback, 0, html);
			}

			return html;
		});
	};

	function registerServiceWorker() {
		// Do not register for Safari browsers
		if (!ajaxify.data._locals.useragent.isSafari && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register(config.relative_path + '/service-worker.js', { scope: config.relative_path + '/' })
				.then(function () {
					console.info('ServiceWorker registration succeeded.');
				}).catch(function (err) {
					console.info('ServiceWorker registration failed: ', err);
				});
		}
	}
}());
