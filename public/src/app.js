'use strict';

window.$ = require('jquery');

window.jQuery = window.$;
require('bootstrap');
window.bootbox = require('bootbox');
require('jquery-form');
window.utils = require('./utils');
require('timeago');

const Visibility = require('visibilityjs');
const Benchpress = require('benchpressjs');
Benchpress.setGlobal('config', config);

require('./sockets');
require('./overrides');
require('./ajaxify');

app = window.app || {};

app.isFocused = true;
app.currentRoom = null;
app.widgets = {};
app.flags = {};

window.addEventListener('DOMContentLoaded', async function () {
	if (app.user.timeagoCode && app.user.timeagoCode !== 'en') {
		await import(/* webpackChunkName: "timeago/[request]" */ 'timeago/locales/jquery.timeago.' + app.user.timeagoCode);
	}
	ajaxify.parseData();
	app.load();
});

(function () {
	let appLoaded = false;
	const isTouchDevice = utils.isTouchDevice();

	app.cacheBuster = config['cache-buster'];

	app.coldLoad = function () {
		if (appLoaded) {
			ajaxify.coldLoad();
		} else {
			$(window).one('action:app.load', ajaxify.coldLoad);
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
			let earlyQueue = []; // once we can ES6, use Set instead
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
			'messages',
			'search',
			'forum/header',
			'hooks',
		], function (taskbar, helpers, pagination, messages, search, header, hooks) {
			header.prepareDOM();
			taskbar.init();
			helpers.register();
			pagination.init();
			search.init();
			overrides.overrideTimeago();
			hooks.fire('action:app.load');
			messages.show();
			appLoaded = true;
		});
	};

	app.require = async function (modules) {
		const single = !Array.isArray(modules);
		if (single) {
			modules = [modules];
		}
		async function requireModule(moduleName) {
			let _module;
			try {
				switch (moduleName) {
					case 'bootbox': return require('bootbox');
					case 'benchpressjs': return require('benchpressjs');
				}
				if (moduleName.startsWith('admin')) {
					_module = await import(/* webpackChunkName: "admin/[request]" */ 'admin/' + moduleName.replace(/^admin\//, ''));
				} else if (moduleName.startsWith('forum')) {
					_module = await import(/* webpackChunkName: "forum/[request]" */ 'forum/' + moduleName.replace(/^forum\//, ''));
				} else {
					_module = await import(/* webpackChunkName: "modules/[request]" */ 'modules/' + moduleName);
				}
			} catch (err) {
				console.warn(`error loading ${moduleName}\n${err.stack}`);
			}
			return _module && _module.default;
		}
		const result = await Promise.all(modules.map(requireModule));
		return single ? result.pop() : result;
	}

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
					require(['alerts'], function (alerts) {
						alerts.error(err);
					});
					return;
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
				require(['alerts'], function (alerts) {
					alerts.error(err);
				});
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
		els.find('.avatar,img[title].teaser-pic,img[title].user-img,div.user-icon,span.user-icon').one('mouseenter', function (ev) {
			const $this = $(this);
			// perf: create tooltips on demand
			$this.tooltip({
				placement: placement || $this.attr('title-placement') || 'top',
				title: $this.attr('title'),
				container: '#content',
			});
			// this will cause the tooltip to show up
			$this.trigger(ev);
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
		if (!config.useragent.isSafari && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register(config.relative_path + '/service-worker.js', { scope: config.relative_path + '/' })
				.then(function () {
					console.info('ServiceWorker registration succeeded.');
				}).catch(function (err) {
					console.info('ServiceWorker registration failed: ', err);
				});
		}
	}
}());
