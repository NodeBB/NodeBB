"use strict";
/*global define, app, ajaxify, socket, Mousetrap, Hammer, RELATIVE_PATH*/

var admin = {};

(function() {
	admin.searchIndex = null;

	admin.enableColorPicker = function(inputEl, callback) {
		(inputEl instanceof jQuery ? inputEl : $(inputEl)).each(function() {
			var $this = $(this);

			$this.ColorPicker({
				color: $this.val() || '#000',
				onChange: function(hsb, hex) {
					$this.val('#' + hex);
					if (typeof callback === 'function') {
						callback(hsb, hex);
					}
				},
				onShow: function(colpkr) {
					$(colpkr).css('z-index', 1051);
				}
			});
		});
	};

	$(document).ready(function() {
		setupMenu();
		setupKeybindings();

		if(!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
			getSearchIndex();
		} else {
			activateMobile();
		}

		$(window).on('action:ajaxify.end', function(ev, data) {
			var url = data.url;

			selectMenuItem(data.url);
		});
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
	});

	function setupMenu() {
		var listElements = $('.sidebar-nav li');

		listElements.on('click', function() {
			var $this = $(this);

			if ($this.hasClass('nav-header')) {
				$this.parents('.sidebar-nav').toggleClass('open').bind('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function (ev) {
					$('.nano').nanoScroller();
				});
			} else {
				listElements.removeClass('active');
				$this.addClass('active');
			}
		});

		$('.nano').nanoScroller();

		$('#main-menu .nav-list > li a').append('<span class="pull-right"><i class="fa fa-inverse fa-arrow-circle-right"></i>&nbsp;</span>');
	}

	function setupKeybindings() {
		Mousetrap.bind('ctrl+shift+a r', function() {
			console.log('[admin] Reloading NodeBB...');
			socket.emit('admin.reload');
		});

		Mousetrap.bind('ctrl+shift+a R', function() {
			console.log('[admin] Restarting NodeBB...');
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
		$('#main-menu .nav-list > li').removeClass('active').each(function() {
			var menu = $(this),
				category = menu.parents('.sidebar-nav'),
				href = menu.children('a').attr('href');

			if (href && href.slice(1).indexOf(url) !== -1) {
				category.addClass('open');
				menu.addClass('active');
				modifyBreadcrumb(category.find('.nav-header').text(), menu.text());
				return false;
			}
		});
	}

	function modifyBreadcrumb() {
		var caret = ' <i class="fa fa-angle-right"></i> ';
		
		$('#breadcrumbs').html(caret + Array.prototype.slice.call(arguments).join(caret));
	}

	function getSearchIndex() {
		$.getJSON(RELATIVE_PATH + '/templates/indexed.json', function (data) {
			admin.searchIndex = data;
			for (var file in admin.searchIndex) {
				if (admin.searchIndex.hasOwnProperty(file)) {
					admin.searchIndex[file] = admin.searchIndex[file].replace(/<img/g, '<none'); // can't think of a better solution, see #2153
					admin.searchIndex[file] = $('<div class="search-container">' + admin.searchIndex[file] + '</div>');
					admin.searchIndex[file].find('script').remove();

					admin.searchIndex[file] = admin.searchIndex[file].text().toLowerCase().replace(/[ |\r|\n]+/g, ' ');
				}
			}

			delete admin.searchIndex['/admin/header.tpl'];
			delete admin.searchIndex['/admin/footer.tpl'];

			setupACPSearch();
		});
	}
	
	function setupACPSearch() {
		var menu = $('#acp-search .dropdown-menu'),
			routes = [],
			input = $('#acp-search input'),
			firstResult = null;

		input.on('keyup', function() {
			$('#acp-search .dropdown').addClass('open');
		});

		$('#acp-search').parents('form').on('submit', function(ev) {
			var input = $(this).find('input'),
				href = firstResult ? firstResult : RELATIVE_PATH + '/search/' + input.val();

			ajaxify.go(href.replace(/^\//, ''));

			setTimeout(function() {
				$('#acp-search .dropdown').removeClass('open');
				$(input).blur();
			}, 150);

			ev.preventDefault();
			return false;
		});

		$('.sidebar-nav a').each(function(idx, link) {
			routes.push($(link).attr('href'));
		});

		input.on('blur', function() {
			$(this).val('').attr('placeholder', '/');
		});

		input.on('keyup focus', function() {
			var $input = $(this),
				value = $input.val().toLowerCase(),
				menuItems = $('#acp-search .dropdown-menu').html('');

			function toUpperCase(txt){
				return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
			}

			$input.attr('placeholder', '');

			firstResult = null;

			if (value.length >= 3) {
				for (var file in admin.searchIndex) {
					if (admin.searchIndex.hasOwnProperty(file)) {
						var position = admin.searchIndex[file].indexOf(value);

						if (position !== -1) {
							var href = file.replace('.tpl', ''),
								title = href.replace(/^\/admin\//, '').split('/'),
								description = admin.searchIndex[file].substring(Math.max(0, position - 25), Math.min(admin.searchIndex[file].length - 1, position + 25))
									.replace(value, '<span class="search-match">' + value + '</span>');

							for (var t in title) {
								if (title.hasOwnProperty(t)) {
									title[t] = title[t]
										.replace('-', ' ')
										.replace(/\w\S*/g, toUpperCase);
								}
							}

							title = title.join(' > ');
							href = RELATIVE_PATH + href;
							firstResult = firstResult ? firstResult : href;

							if ($.inArray(href, routes) !== -1) {
								menuItems.append('<li role="presentation"><a role="menuitem" href="' + href + '">' + title + '<br /><small><code>...' + description + '...</code></small></a></li>');
							}
						}
					}
				}

				if (menuItems.html() !== '') {
					menuItems.append('<li role="presentation" class="divider"></li>');
				}
			}

			if (value.length > 0) {
				menuItems.append('<li role="presentation"><a role="menuitem" href="' + RELATIVE_PATH + '/search/' + value + '">Search the forum for <strong>' + value + '</strong></a></li>');
			} else {
				menuItems.append('<li role="presentation"><a role="menuitem" href="#">Start typing to see results...</a></li>');
			}
		});
	}
}());