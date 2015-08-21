"use strict";
/*globals define, admin, ajaxify, RELATIVE_PATH*/

define(function() {
	var search = {},
		searchIndex;

	search.init = function() {
		$.getJSON(RELATIVE_PATH + '/templates/indexed.json', function (data) {
			searchIndex = data;
			for (var file in searchIndex) {
				if (searchIndex.hasOwnProperty(file)) {
					searchIndex[file] = searchIndex[file].replace(/<img/g, '<none'); // can't think of a better solution, see #2153
					searchIndex[file] = $('<div class="search-container">' + searchIndex[file] + '</div>');
					searchIndex[file].find('script').remove();

					searchIndex[file] = searchIndex[file].text().toLowerCase().replace(/[ |\r|\n]+/g, ' ');
				}
			}

			delete searchIndex['/admin/header.tpl'];
			delete searchIndex['/admin/footer.tpl'];

			setupACPSearch();
		});
	};

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

		$('#main-menu a').each(function(idx, link) {
			routes.push($(link).attr('href'));
		});

		input.on('keyup focus', function() {
			var $input = $(this),
				value = $input.val().toLowerCase(),
				menuItems = $('#acp-search .dropdown-menu').html('');

			function toUpperCase(txt){
				return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
			}

			firstResult = null;

			if (value.length >= 3) {
				for (var file in searchIndex) {
					if (searchIndex.hasOwnProperty(file)) {
						var position = searchIndex[file].indexOf(value);

						if (position !== -1) {
							var href = file.replace('.tpl', ''),
								title = href.replace(/^\/admin\//, '').split('/'),
								description = searchIndex[file].substring(Math.max(0, position - 25), Math.min(searchIndex[file].length - 1, position + 25))
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

				if (menuItems.html() === '') {
					menuItems.append('<li role="presentation"><a role="menuitem" href="#">No results...</a></li>');
				}
			}

			if (value.length > 0) {
				if (config.searchEnabled) {
					menuItems.append('<li role="presentation" class="divider"></li>');
					menuItems.append('<li role="presentation"><a role="menuitem" target="_top" href="' + RELATIVE_PATH + '/search/' + value + '">Search the forum for <strong>' + value + '</strong></a></li>');
				} else if (value.length < 3) {
					menuItems.append('<li role="presentation"><a role="menuitem" href="#">Type more to see results...</a></li>');
				}
			} else {
				menuItems.append('<li role="presentation"><a role="menuitem" href="#">Start typing to see results...</a></li>');
			}
		});
	}

	return search;
});