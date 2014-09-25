"use strict";
/*global define, app, socket, RELATIVE_PATH */

define('forum/admin/footer', ['forum/admin/settings'], function(Settings) {
	var acpIndex;

	$(document).ready(function() {
		$.getJSON(RELATIVE_PATH + '/templates/indexed.json', function (data) {
			acpIndex = data;
			for (var file in acpIndex) {
				if (acpIndex.hasOwnProperty(file)) {
					acpIndex[file] = acpIndex[file].replace(/<script[\s\S]*?<\/script>/g, '');
					acpIndex[file] = $(acpIndex[file]).text().toLowerCase();
				}
			}

			delete acpIndex['/admin/header.tpl'];
			delete acpIndex['/admin/footer.tpl'];

			setupACPSearch();
		});
	});

	function setupACPSearch() {
		var menu = $('#acp-search .dropdown-menu');

		$('#acp-search input').on('keyup focus', function() {
			var $input = $(this),
				value = $input.val().toLowerCase(),
				menuItems = $('#acp-search .dropdown-menu').html('');

			if (value.length >= 3) {
				for (var file in acpIndex) {
					if (acpIndex.hasOwnProperty(file)) {
						var position = acpIndex[file].indexOf(value);

						if (position !== -1) {
							var href = file.replace('.tpl', ''),
								title = href.replace(/^\/admin\//, '').split('/'),
								description = acpIndex[file].substring(Math.max(0, position - 15), Math.min(acpIndex[file].length - 1, position + 15))
									.replace(value, '<span class="search-match">' + value + '</span>');

							for (var t in title) {
								if (title.hasOwnProperty(t)) {
									title[t] = title[t]
										.replace('-', ' ')
										.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
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
				menuItems.append('<li role="presentation"><a role="menuitem" href="' + RELATIVE_PATH + '/search/' + value + '">Click here for forum-wide search</a></li>');
			}
		});
	}
});