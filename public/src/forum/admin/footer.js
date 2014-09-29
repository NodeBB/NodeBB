"use strict";
/*global define, app, socket, Hammer, RELATIVE_PATH */

define('forum/admin/footer', ['forum/admin/settings'], function(Settings) {
	var acpIndex;

	$(document).ready(function() {
		if(!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
			getSearchIndex();
		} else {
			activateMobile();
		}

		$(window).on('action:ajaxify.end', function(ev, data) {
			var url = data.url;

			selectMenuItem(data.url);
		});

		setupMainMenu();
	});

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

	function setupMainMenu() {
		$('.sidebar-nav .nav-header').on('click', function() {
			$(this).parents('.sidebar-nav').toggleClass('open');
			setTimeout(function() {
				$('.nano').nanoScroller();
			}, 500); // replace with animationend event
		});

		$('.nano').nanoScroller();

		$('#main-menu .nav-list > li a').append('<span class="pull-right"><i class="fa fa-inverse fa-arrow-circle-right"></i>&nbsp;</span>');
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
			acpIndex = data;
			for (var file in acpIndex) {
				if (acpIndex.hasOwnProperty(file)) {
					acpIndex[file] = acpIndex[file].replace(/<img/g, '<none'); // can't think of a better solution, see #2153
					acpIndex[file] = $('<div class="search-container">' + acpIndex[file] + '</div>');
					acpIndex[file].find('ul.nav, script').remove();

					acpIndex[file] = acpIndex[file].text().toLowerCase().replace(/[ |\r|\n]+/g, ' ');
				}
			}

			delete acpIndex['/admin/header.tpl'];
			delete acpIndex['/admin/footer.tpl'];

			setupACPSearch();
		});
	}
	
	function setupACPSearch() {
		var menu = $('#acp-search .dropdown-menu');

		$('#acp-search input').on('keyup', function() {
			$('#acp-search .dropdown').addClass('open');
		});

		$('#acp-search input').on('keyup focus', function() {
			var $input = $(this),
				value = $input.val().toLowerCase(),
				menuItems = $('#acp-search .dropdown-menu').html('');

			function toUpperCase(txt){
				return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
			}

			if (value.length >= 3) {
				for (var file in acpIndex) {
					if (acpIndex.hasOwnProperty(file)) {
						var position = acpIndex[file].indexOf(value);

						if (position !== -1) {
							var href = file.replace('.tpl', ''),
								title = href.replace(/^\/admin\//, '').split('/'),
								description = acpIndex[file].substring(Math.max(0, position - 25), Math.min(acpIndex[file].length - 1, position + 25))
									.replace(value, '<span class="search-match">' + value + '</span>');

							for (var t in title) {
								if (title.hasOwnProperty(t)) {
									title[t] = title[t]
										.replace('-', ' ')
										.replace(/\w\S*/g, toUpperCase);
								}
							}

							title = title.join(' > ');

							menuItems.append('<li role="presentation"><a role="menuitem" href="' + RELATIVE_PATH + href + '">' + title + '<br /><small><code>...' + description + '...</code></small></a></li>');
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
});