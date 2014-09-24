"use strict";
/*global define, app, socket, RELATIVE_PATH */

define('forum/admin/footer', ['forum/admin/settings'], function(Settings) {
	var acpIndex;

	$(document).ready(function() {
		$.getJSON(RELATIVE_PATH + '/templates/indexed.json', function (data) {
			acpIndex = data;
			for (var file in acpIndex) {
				if (acpIndex.hasOwnProperty(file)) {
					acpIndex[file] = $(acpIndex[file]).text();
				}
			}

			setupACPSearch();
		});
	});

	function setupACPSearch() {
		var menu = $('#acp-search .dropdown-menu');

		$('#acp-search input').on('keyup focus', function() {
			var $input = $(this),
				menuItems = $('#acp-search .dropdown-menu').html('');

			if ($input.val().length > 3) {
				for (var file in acpIndex) {
					if (acpIndex.hasOwnProperty(file)) {
						if (acpIndex[file].indexOf($input.val()) !== -1) {
							var href = file.replace('.tpl', ''),
								title = href.replace(/^\/admin\//, '').split('/');

							for (var t in title) {
								if (title.hasOwnProperty(t)) {
									title[t] = title[t]
										.replace('-', ' ')
										.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
								}
							}

							title = title.join(' > ');

							menuItems.append('<li role="presentation"><a role="menuitem" href="' + RELATIVE_PATH + href + '">' + title + '</a></li>');
						}
					}
				}

				menuItems.append('<li role="presentation" class="divider"></li>');
			}

			menuItems.append('<li role="presentation"><a role="menuitem" href="' + RELATIVE_PATH + '/search/' + $input.val() + '">Search the forum for "' + $input.val() + '"</a></li>');
		});
	}
});