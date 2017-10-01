'use strict';

define('admin/modules/search', ['mousetrap'], function (mousetrap) {
	var search = {};

	function find(dict, term) {
		var html = dict.filter(function (elem) {
			return elem.translations.toLowerCase().includes(term);
		}).map(function (params) {
			var namespace = params.namespace;
			var translations = params.translations;
			var title = params.title;
			var escaped = utils.escapeRegexChars(term);

			var results = translations
				// remove all lines without a match
				.replace(new RegExp('^(?:(?!' + escaped + ').)*$', 'gmi'), '')
				// remove lines that only match the title
				.replace(new RegExp('(^|\\n).*?' + title + '.*?(\\n|$)', 'g'), '')
				// get up to 25 characters of context on both sides of the match
				// and wrap the match in a `.search-match` element
				.replace(
					new RegExp('^[\\s\\S]*?(.{0,25})(' + escaped + ')(.{0,25})[\\s\\S]*?$', 'gmi'),
					'...$1<span class="search-match">$2</span>$3...<br>'
				)
				// collapse whitespace
				.replace(/(?:\n ?)+/g, '\n')
				.trim();

			title = title.replace(
				new RegExp('(^.*?)(' + escaped + ')(.*?$)', 'gi'),
				'$1<span class="search-match">$2</span>$3'
			);

			return '<li role="presentation" class="result">' +
				'<a role= "menuitem" href= "' + config.relative_path + '/' + namespace + '" >' +
					title +
					'<br>' + (!results ? '' :
				('<small><code>' +
						results +
					'</small></code>')) +
				'</a>' +
			'</li>';
		}).join('');
		return html;
	}

	search.init = function () {
		socket.emit('admin.getSearchDict', {}, function (err, dict) {
			if (err) {
				app.alertError(err);
				throw err;
			}
			setupACPSearch(dict);
		});
	};

	function setupACPSearch(dict) {
		var dropdown = $('#acp-search .dropdown');
		var menu = $('#acp-search .dropdown-menu');
		var input = $('#acp-search input');

		if (!config.searchEnabled) {
			menu.addClass('search-disabled');
		}

		input.on('keyup', function () {
			dropdown.addClass('open');
		});

		$('#acp-search').parents('form').on('submit', function (ev) {
			var selected = menu.find('li.result > a.focus').attr('href');
			if (!selected.length) {
				selected = menu.find('li.result > a').first().attr('href');
			}
			var href = selected || config.relative_path + '/search?in=titlesposts&term=' + escape(input.val());

			ajaxify.go(href.replace(/^\//, ''));

			setTimeout(function () {
				dropdown.removeClass('open');
				input.blur();
			}, 150);

			ev.preventDefault();
			return false;
		});

		mousetrap(input[0]).bind(['up', 'down'], function (ev, key) {
			var next;
			if (key === 'up') {
				next = menu.find('li.result > a.focus').removeClass('focus').parent().prev('.result').children();
				if (!next.length) {
					next = menu.find('li.result > a').last();
				}
				next.addClass('focus');
				if (menu[0].getBoundingClientRect().top > next[0].getBoundingClientRect().top) {
					next[0].scrollIntoView(true);
				}
			} else if (key === 'down') {
				next = menu.find('li.result > a.focus').removeClass('focus').parent().next('.result').children();
				if (!next.length) {
					next = menu.find('li.result > a').first();
				}
				next.addClass('focus');
				if (menu[0].getBoundingClientRect().bottom < next[0].getBoundingClientRect().bottom) {
					next[0].scrollIntoView(false);
				}
			}

			ev.preventDefault();
		});

		var prevValue;

		input.on('keyup focus', function () {
			var value = input.val().toLowerCase();

			if (value === prevValue) {
				return;
			}
			prevValue = value;

			menu.children('.result').remove();

			var len = /\W/.test(value) ? 3 : value.length;
			var results;

			menu.toggleClass('state-start-typing', len === 0);
			menu.toggleClass('state-keep-typing', len > 0 && len < 3);

			if (len >= 3) {
				menu.prepend(find(dict, value));

				results = menu.children('.result').length;

				menu.toggleClass('state-no-results', !results);
				menu.toggleClass('state-yes-results', !!results);

				menu.find('.search-forum')
					.not('.divider')
					.find('a')
					.attr('href', config.relative_path + '/search?in=titlesposts&term=' + escape(value))
					.find('strong')
					.text(value);
			} else {
				menu.removeClass('state-no-results state-yes-results');
			}
		});
	}

	return search;
});
