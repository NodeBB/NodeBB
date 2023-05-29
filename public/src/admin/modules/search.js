'use strict';

define('admin/modules/search', ['mousetrap', 'alerts'], function (mousetrap, alerts) {
	const search = {};

	function find(dict, term) {
		const html = dict.filter(function (elem) {
			return elem.translations.toLowerCase().includes(term);
		}).map(function (params) {
			const namespace = params.namespace;
			const translations = params.translations;
			let title = params.title;
			const escaped = utils.escapeRegexChars(term);

			const results = translations
				// remove all lines without a match
				.replace(new RegExp('^(?:(?!' + escaped + ').)*$', 'gmi'), '')
				// remove lines that only match the title
				.replace(new RegExp('(^|\\n).*?' + title + '.*?(\\n|$)', 'g'), '')
				// get up to 25 characters of context on both sides of the match
				// and wrap the match in a `.search-match` element
				.replace(
					new RegExp('^[\\s\\S]*?(.{0,25})(' + escaped + ')(.{0,25})[\\s\\S]*?$', 'gmi'),
					'...$1<span class="search-match fw-bold">$2</span>$3...<br>'
				)
				// collapse whitespace
				.replace(/(?:\n ?)+/g, '\n')
				.trim();

			title = title.replace(
				new RegExp('(^.*?)(' + escaped + ')(.*?$)', 'gi'),
				'$1<span class="search-match">$2</span>$3'
			);

			return '<li role="presentation" class="result">' +
				'<a class="dropdown-item rounded-1" role="menuitem" href= "' + config.relative_path + '/' + namespace + '" >' +
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
		if (!app.user.privileges['admin:settings']) {
			return;
		}

		socket.emit('admin.getSearchDict', {}, function (err, dict) {
			if (err) {
				alerts.error(err);
				throw err;
			}
			setupACPSearch(dict);
		});
	};

	function setupACPSearch(dict) {
		const searchEls = $('[component="acp/search"]');
		searchEls.each((index, searchEl) => {
			setupSearch(dict, $(searchEl));
		});
	}

	function setupSearch(dict, searchEl) {
		const dropdown = searchEl.find('.dropdown');
		const menu = searchEl.find('.dropdown-menu');
		const input = searchEl.find('input');
		const placeholderText = dropdown.attr('data-text');
		if (!config.searchEnabled) {
			menu.addClass('search-disabled');
		}

		input.on('keyup', function () {
			dropdown.addClass('open');
		});

		searchEl.parents('form').on('submit', function (ev) {
			const query = input.val();
			const selected = menu.get(0).querySelector('li.result > a.focus') || menu.get(0).querySelector('li.result > a');
			const href = selected ? selected.getAttribute('href') : config.relative_path + '/search?in=titlesposts&term=' + escape(query);

			ajaxify.go(href.replace(/^\//, ''));

			setTimeout(function () {
				dropdown.removeClass('open');
				input.blur();
				dropdown.attr('data-text', query || placeholderText);
			}, 150);

			ev.preventDefault();
			return false;
		});

		mousetrap.bind('/', function (ev) {
			input.select();
			ev.preventDefault();
		});

		mousetrap(input[0]).bind(['up', 'down'], function (ev, key) {
			let next;
			if (key === 'up') {
				next = menu.find('li.result > a.focus').removeClass('focus').parent().prev('.result')
					.children();
				if (!next.length) {
					next = menu.find('li.result > a').last();
				}
				next.addClass('focus');
				if (menu[0].getBoundingClientRect().top > next[0].getBoundingClientRect().top) {
					next[0].scrollIntoView(true);
				}
			} else if (key === 'down') {
				next = menu.find('li.result > a.focus').removeClass('focus').parent().next('.result')
					.children();
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

		let prevValue;

		input.on('keyup focus', function () {
			const value = input.val().toLowerCase();

			if (value === prevValue) {
				return;
			}
			prevValue = value;

			menu.children('.result').remove();

			const len = /\W/.test(value) ? 3 : value.length;
			let results;

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
