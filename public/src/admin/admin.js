"use strict";
/*global config, translator, componentHandler, define, socket, app, ajaxify, utils, bootbox, Slideout, RELATIVE_PATH*/

(function() {
	$(document).ready(function() {
		setupKeybindings();

		// on page reload show correct tab if url has #
		if (window.location.hash) {
			$('.nav-pills a[href=' + window.location.hash + ']').tab('show');
		}

		if(!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
			require(['admin/modules/search'], function(search) {
				search.init();
			});
		}

		$('[component="logout"]').on('click', app.logout);
		app.alert = launchSnackbar;

		configureSlidemenu();
	});

	$(window).on('action:ajaxify.contentLoaded', function(ev, data) {
		var url = data.url;

		selectMenuItem(data.url);
		setupRestartLinks();

		componentHandler.upgradeDom();
	});

	function setupKeybindings() {
		require(['mousetrap'], function(mousetrap) {
			mousetrap.bind('ctrl+shift+a r', function() {
				require(['admin/modules/instance'], function(instance) {
					instance.reload();
				});
			});

			mousetrap.bind('ctrl+shift+a R', function() {
				socket.emit('admin.restart');
			});

			mousetrap.bind('/', function(e) {
				$('#acp-search input').focus();

				return false;
			});
		});
	}

	function selectMenuItem(url) {
		url = url
			.replace(/\/\d+$/, '')
			.split('/').slice(0, 3).join('/')
			.split('?')[0];

		// If index is requested, load the dashboard
		if (url === 'admin') {
			url = 'admin/general/dashboard';
		}

		$('#main-menu li').removeClass('active');
		$('#main-menu a').removeClass('active').each(function() {
			var menu = $(this),
				href = menu.attr('href'),
				isLink = menu.parent().attr('data-link') === '1';

			if (!isLink && href && href === [config.relative_path, url].join('/')) {
				menu
					.parent().addClass('active')
					.parents('.menu-item').addClass('active');

				$('#main-page-title').text(menu.text() + (menu.parents('.menu-item').children('a').text() === 'Settings' ? ' Settings' : ''));
			}
		});

		var acpPath = url.replace('admin/', '').split('/');
		acpPath.forEach(function(path, i) {
			acpPath[i] = path.charAt(0).toUpperCase() + path.slice(1);
		});
		acpPath = acpPath.join(' > ');

		document.title = (url === 'admin/general/dashboard' ? 'Dashboard' : acpPath) + ' | NodeBB Admin Control Panel';
	}

	function setupRestartLinks() {
		$('.restart').off('click').on('click', function() {
			bootbox.confirm('Are you sure you wish to restart NodeBB?', function(confirm) {
				if (confirm) {
					require(['admin/modules/instance'], function(instance) {
						instance.restart();
					});
				}
			});
		});

		$('.reload').off('click').on('click', function() {
			require(['admin/modules/instance'], function(instance) {
				instance.reload();
			});
		});
	}

	function launchSnackbar(params) {
		var message = (params.title ? "<strong>" + params.title + "</strong>" : '') + (params.message ? params.message : '');

		require(['translator'], function(translator) {
			translator.translate(message, function(html) {
				var bar = $.snackbar({
					content: html,
					timeout: 3000,
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

		$('#mobile-menu').on('click', function() {
			slideout.toggle();
		});

		$('#menu a').on('click', function() {
			slideout.close();
		});

		$(window).on('resize', function() {
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

		slideout.on('close', function() {
			$('#header').css({
				'top': '0px',
				'position': 'fixed'
			});
		});
	}
}());