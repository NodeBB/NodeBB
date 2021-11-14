'use strict';


app = window.app || {};

app.isFocused = true;
app.currentRoom = null;
app.widgets = {};
app.flags = {};

(function () {
	let appLoaded = false;
	const isTouchDevice = utils.isTouchDevice();

	app.cacheBuster = config['cache-buster'];

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
		$('body').on('click', '#new_topic', function (e) {
			e.preventDefault();
			app.newTopic();
		});

		Visibility.change(function (event, state) {
			app.isFocused = state === 'visible';
		});

		registerServiceWorker();

		require([
			'taskbar',
			'helpers',
			'forum/pagination',
			'translator',
			'messages',
			'search',
			'forum/unread',
			'forum/header',
			'hooks',
			'timeago/jquery.timeago',
		], function (taskbar, helpers, pagination, translator, messages, search, unread, header, hooks) {
			header.prepareDOM();
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
		const single = !Array.isArray(modules);
		if (single) {
			modules = [modules];
		}

		return new Promise((resolve, reject) => {
			require(modules, (...exports) => {
				resolve(single ? exports.pop() : exports);
			}, reject);
		});
	};

	app.logout = function (redirect) {
		console.warn('[deprecated] app.logout is deprecated, please use logout module directly');
		require(['logout'], function (logout) {
			logout(redirect);
		});
	};

	app.alert = function (params) {
		console.warn('[deprecated] app.alert is deprecated, please use alerts.alert');
		require(['alerts'], function (alerts) {
			alerts.alert(params);
		});
	};

	app.removeAlert = function (id) {
		console.warn('[deprecated] app.removeAlert is deprecated, please use alerts.remove');
		require(['alerts'], function (alerts) {
			alerts.remove(id);
		});
	};

	app.alertSuccess = function (message, timeout) {
		console.warn('[deprecated] app.alertSuccess is deprecated, please use alerts.success');
		require(['alerts'], function (alerts) {
			alerts.success(message, timeout);
		});
	};

	app.alertError = function (message, timeout) {
		console.warn('[deprecated] app.alertError is deprecated, please use alerts.error');
		require(['alerts'], function (alerts) {
			alerts.error(message, timeout);
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
		console.warn('[deprecated] app.openChat is deprecated, please use chat.openChat');
		require(['chat'], function (chat) {
			chat.openChat(roomId, uid);
		});
	};

	app.newChat = function (touid, callback) {
		console.warn('[deprecated] app.newChat is deprecated, please use chat.newChat');
		require(['chat'], function (chat) {
			chat.newChat(touid, callback);
		});
	};

	app.toggleNavbar = function (state) {
		require(['components'], (components) => {
			const navbarEl = components.get('navbar');
			navbarEl[state ? 'show' : 'hide']();
		});
	};

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
		require(['hooks'], function (hooks) {
			hooks.fire('action:composer.topic.new', {
				cid: cid || ajaxify.data.cid || 0,
				tags: tags || (ajaxify.data.tag ? [ajaxify.data.tag] : []),
			});
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
