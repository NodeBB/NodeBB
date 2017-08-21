'use strict';

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
				},
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

		if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
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
				.split(/[?#]/)[0].replace(/(\/+$)|(^\/+)/, '');

			// If index is requested, load the dashboard
			if (url === 'admin') {
				url = 'admin/general/dashboard';
			}

			url = [config.relative_path, url].join('/');
			var fallback;

			$('#main-menu li').removeClass('active');
			$('#main-menu a').removeClass('active').filter('[href="' + url + '"]').each(function () {
				var menu = $(this);
				if (menu.parent().attr('data-link')) {
					return;
				}

				menu
					.parent().addClass('active')
					.parents('.menu-item').addClass('active');
				fallback = menu.text();
			});

			var mainTitle;
			var pageTitle;
			if (/admin\/general\/dashboard$/.test(url)) {
				pageTitle = '[[admin/menu:general/dashboard]]';
				mainTitle = pageTitle;
			} else if (/admin\/plugins\//.test(url)) {
				mainTitle = fallback;
				pageTitle = '[[admin/menu:section-plugins]] > ' + mainTitle;
			} else {
				var matches = url.match(/admin\/(.+?)\/(.+?)$/);
				mainTitle = '[[admin/menu:' + matches[1] + '/' + matches[2] + ']]';
				pageTitle = '[[admin/menu:section-' +
					(matches[1] === 'development' ? 'advanced' : matches[1]) +
					']]' + (matches[2] ? (' > ' + mainTitle) : '');
				if (matches[2] === 'settings') {
					mainTitle = translator.compile('admin/menu:settings.page-title', mainTitle);
				}
			}

			pageTitle = translator.compile('admin/admin:acp-title', pageTitle);

			translator.translate(pageTitle, function (title) {
				document.title = title.replace(/&gt;/g, '>');
			});
			translator.translate(mainTitle, function (text) {
				$('#main-page-title').text(text);
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
		var message = (params.title ? '<strong>' + params.title + '</strong>' : '') + (params.message ? params.message : '');

		require(['translator'], function (translator) {
			translator.translate(message, function (html) {
				var bar = $.snackbar({
					content: html,
					timeout: params.timeout || 3000,
					htmlAllowed: true,
				});

				if (params.clickfn) {
					bar.on('click', params.clickfn);
				}
			});
		});
	}

	function configureSlidemenu() {
		var env = utils.findBootstrapEnvironment();

		var slideout = new Slideout({
			panel: document.getElementById('panel'),
			menu: document.getElementById('menu'),
			padding: 256,
			tolerance: 70,
		});

		if (env === 'md' || env === 'lg') {
			slideout.disableTouch();
		}

		$('#mobile-menu').on('click', function () {
			slideout.toggle();
		});

		$('#menu a').on('click', function () {
			slideout.close();
		});

		$(window).on('resize', function () {
			slideout.close();

			env = utils.findBootstrapEnvironment();

			if (env === 'md' || env === 'lg') {
				slideout.disableTouch();
				$('#header').css({
					position: 'relative',
				});
			} else {
				slideout.enableTouch();
				$('#header').css({
					position: 'fixed',
				});
			}
		});

		function onOpeningMenu() {
			$('#header').css({
				top: ($('#panel').position().top * -1) + 'px',
				position: 'absolute',
			});
		}

		slideout.on('open', onOpeningMenu);

		slideout.on('close', function () {
			$('#header').css({
				top: '0px',
				position: 'fixed',
			});
		});
	}

	// tell ace to use the right paths when requiring modules
	require(['ace/ace'], function (ace) {
		ace.config.set('packaged', true);
		ace.config.set('basePath', config.relative_path + '/assets/src/modules/ace/');
	});
}());
