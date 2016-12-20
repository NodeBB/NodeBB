"use strict";
/*global config, componentHandler, socket, app, bootbox, Slideout, NProgress*/

(function () {
	var logoutTimer = 0;
	function startLogoutTimer() {
		if (logoutTimer) {
			clearTimeout(logoutTimer);
		}

		logoutTimer = setTimeout(function () {
			bootbox.alert({
				closeButton: false,
				message: '[[login:logged-out-due-to-inactivity]]',
				callback: function () {
					window.location.reload();
				}
			});
		}, 3600000);
	}

	$(window).on('action:ajaxify.end', function () {
		showCorrectNavTab();
		startLogoutTimer();
	});

	function showCorrectNavTab() {
		// show correct tab if url has #
		if (window.location.hash) {
			$('.nav-pills a[href="' + window.location.hash + '"]').tab('show');
		}
	}

	$(document).ready(function () {
		setupKeybindings();

		if(!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
			require(['admin/modules/search'], function (search) {
				search.init();
			});
		}

		$('[component="logout"]').on('click', app.logout);
		app.alert = launchSnackbar;

		configureSlidemenu();
		setupNProgress();
	});

	$(window).on('action:ajaxify.contentLoaded', function (ev, data) {
		selectMenuItem(data.url);
		setupRestartLinks();

		componentHandler.upgradeDom();
	});

	function setupNProgress() {
		$(window).on('action:ajaxify.start', function () {
			NProgress.set(0.7);
		});

		$(window).on('action:ajaxify.end', function () {
			NProgress.done();
		});
	}

	function setupKeybindings() {
		require(['mousetrap', 'admin/modules/instance'], function (mousetrap, instance) {
			mousetrap.bind('ctrl+shift+a r', function () {
				instance.reload();
			});

			mousetrap.bind('ctrl+shift+a R', function () {
				socket.emit('admin.restart');
			});

			mousetrap.bind('/', function () {
				$('#acp-search input').focus();

				return false;
			});
		});
	}

	function selectMenuItem(url) {
		require(['translator'], function (translator) {
			url = url
				.replace(/\/\d+$/, '')
				.split('/').slice(0, 3).join('/')
				.split('?')[0].replace(/(\/+$)|(^\/+)/, '');

			// If index is requested, load the dashboard
			if (url === 'admin') {
				url = 'admin/general/dashboard';
			}

			url = [config.relative_path, url].join('/');

			$('#main-menu li').removeClass('active');
			$('#main-menu a').removeClass('active').filter('[href="' + url + '"]').each(function () {
				var menu = $(this);
				menu
					.parent().addClass('active')
					.parents('.menu-item').addClass('active');
				
				var match = menu.attr('href').match(/admin\/((.+?)\/.+?)$/);
				if (!match) {
					return;
				}
				var str = '[[admin/menu:' + match[1] + ']]';
				if (match[2] === 'settings') {
					str = translator.compile('admin/menu:settings.page-title', str);
				}
				translator.translate(str, function (text) {
					$('#main-page-title').text(text);
				});
			});

			var title = url;
			if (/admin\/general\/dashboard$/.test(title)) {
				title = '[[admin/menu:general/dashboard]]';
			} else {
				title = title.match(/admin\/(.+?)\/(.+?)$/);
				title = '[[admin/menu:section-' + 
					(title[1] === 'development' ? 'advanced' : title[1]) +
					']]' + (title[2] ? (' > [[admin/menu:' +
					title[1] + '/' + title[2] + ']]') : '');
			}

			title = '[[admin/admin:acp-title, ' + title + ']]';

			translator.translate(title, function (title) {
				document.title = title.replace(/&gt;/g, '>');
			});
		});
	}

	function setupRestartLinks() {
		$('.reload').off('click').on('click', function () {
			bootbox.confirm('[[admin/admin:alert.confirm-reload]]', function (confirm) {
				if (confirm) {
					require(['admin/modules/instance'], function (instance) {
						instance.reload();
					});
				}
			});
		});

		$('.restart').off('click').on('click', function () {
			bootbox.confirm('[[admin/admin:alert.confirm-restart]]', function (confirm) {
				if (confirm) {
					require(['admin/modules/instance'], function (instance) {
						instance.restart();
					});
				}
			});
		});
	}

	function launchSnackbar(params) {
		var message = (params.title ? "<strong>" + params.title + "</strong>" : '') + (params.message ? params.message : '');

		require(['translator'], function (translator) {
			translator.translate(message, function (html) {
				var bar = $.snackbar({
					content: html,
					timeout: params.timeout || 3000,
					htmlAllowed: true
				});

				if (params.clickfn) {
					bar.on('click', params.clickfn);
				}
			});
		});
	}

	function configureSlidemenu() {
		var slideout = new Slideout({
			'panel': document.getElementById('panel'),
			'menu': document.getElementById('menu'),
			'padding': 256,
			'tolerance': 70
		});

		$('#mobile-menu').on('click', function () {
			slideout.toggle();
		});

		$('#menu a').on('click', function () {
			slideout.close();
		});

		$(window).on('resize', function () {
			slideout.close();
		});

		function onOpeningMenu() {
			$('#header').css({
				'top': $('#panel').position().top * -1 + 'px',
				'position': 'absolute'
			});
		}

		slideout.on('beforeopen', onOpeningMenu);
		slideout.on('open', onOpeningMenu);
		slideout.on('translate', onOpeningMenu);

		slideout.on('close', function () {
			$('#header').css({
				'top': '0px',
				'position': 'fixed'
			});
		});
	}
}());