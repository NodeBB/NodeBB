"use strict";
/*global define, socket, app, ajaxify, utils, bootbox, Mousetrap, Hammer, RELATIVE_PATH*/

(function() {
	$(document).ready(function() {
		setupKeybindings();

		if(!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
			require(['admin/modules/search'], function(search) {
				search.init();
			});
		} else {
			activateMobile();
		}

		$(window).on('action:ajaxify.contentLoaded', function(ev, data) {
			var url = data.url;

			selectMenuItem(data.url);
			setupRestartLinks();
		});

		$(window).on('action:admin.settingsLoaded', setupCheckboxes);

		$('[component="logout"]').on('click', app.logout);
	});

	socket.emit('admin.config.get', function(err, config) {
		if(err) {
			return app.alert({
				alert_id: 'config_status',
				timeout: 2500,
				title: 'Error',
				message: 'NodeBB encountered a problem getting config: ' + err.message,
				type: 'danger'
			});
		}

		// move this to admin.config
		app.config = config;
		$(window).trigger('action:config.loaded');
	});

	function setupKeybindings() {
		Mousetrap.bind('ctrl+shift+a r', function() {
			require(['admin/modules/instance'], function(instance) {
				instance.reload();
			});
		});

		Mousetrap.bind('ctrl+shift+a R', function() {
			socket.emit('admin.restart');
		});

		Mousetrap.bind('/', function(e) {
			$('#acp-search input').focus();

			return false;
		});
	}


	function activateMobile() {
		$('.admin').addClass('mobile');
		$('#main-menu').addClass('transitioning');

		Hammer(document.body).on('swiperight', function(e) {
			$('#main-menu').addClass('open');
		});

		Hammer(document.body).on('swipeleft', function(e) {
			$('#main-menu').removeClass('open');
		});

		Hammer($('#main-menu')[0]).on('swiperight', function(e) {
			$('#main-menu').addClass('open');
		});

		Hammer($('#main-menu')[0]).on('swipeleft', function(e) {
			$('#main-menu').removeClass('open');
		});

		$(window).on('scroll', function() {
			$('#main-menu').height($(window).height() + 20);
		});
	}

	function selectMenuItem(url) {
		url = url.replace(/\/\d+$/, '');

		// If index is requested, load the dashboard
		if (url === 'admin') {
			url = 'admin/general/dashboard';
		}

		$('#main-menu .nav-list > li').removeClass('active').each(function() {
			var menu = $(this),
				category = menu.parents('.sidebar-nav'),
				href = menu.children('a').attr('href'),
				isLink = menu.attr('data-link') === '1';

			if (!isLink && href && href.slice(1) === url) {
				category.addClass('open');
				menu.addClass('active');
				modifyBreadcrumb(category.find('.nav-header').text(), menu.text());
			}
		});
	}

	function modifyBreadcrumb() {
		var caret = ' <i class="fa fa-angle-right"></i> ';

		$('#breadcrumbs').html(caret + Array.prototype.slice.call(arguments).join(caret));
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

	function setupCheckboxes() {
		if (ajaxify.currentPage.match(/^admin\/manage\/categories/)) {
			return $('[type=checkbox]').show();
		}

		$('[type=checkbox]').change(function() {
			var checked = $(this).is(':checked');

			$(this).siblings('[class*=fa-]').toggleClass('fa-toggle-off', !checked)
				.toggleClass('fa-toggle-on', checked);
		});

		$('[type=checkbox]').each(function() {
			var checkbox = $(this),
				checked = checkbox.is(':checked');

			if (checkbox.attr('data-toggle-added')) {
				return;
			}

			checkbox.hide();

			if (checked) {
				checkbox.after('<i class="fa fa-toggle-on"></i>');
			}
			else {
				checkbox.after('<i class="fa fa-toggle-off"></i>');
			}

			checkbox.attr('data-toggle-added', true);
		});
	}

}());