'use strict';

define('tagFilter', ['hooks', 'alerts', 'bootstrap'], function (hooks, alerts, bootstrap) {
	const tagFilter = {};

	tagFilter.init = function (el, options) {
		if (!el || !el.length) {
			return;
		}
		options = options || {};
		options.template = 'partials/tags/filter-dropdown-left';

		hooks.fire('action:tag.filter.options', { el: el, options: options });

		const searchEl = el.find('[component="tag/filter/search"]');

		options.selectedTags = options.selectedTags || ajaxify.data.selectedTags || [];

		let tagList = null;

		let selectedTags = [];
		let initialTags = [];
		if (Array.isArray(options.selectedTags)) {
			selectedTags = options.selectedTags.map(String);
		} else if (Array.isArray(ajaxify.data.selectedTags)) {
			selectedTags = ajaxify.data.selectedTags.map(String);
		}
		initialTags = selectedTags.slice();

		const toggleSearchVisibilty = searchEl.parents('[component="tag/filter"]').length &&
			app.user.privileges['search:tags'];

		el.on('show.bs.dropdown', function () {
			if (toggleSearchVisibilty) {
				searchEl.removeClass('hidden');
			}

			function doSearch() {
				const val = searchEl.find('input').val();
				if (val.length > 1 || (!val && !tagList)) {
					loadList(val, function (tags) {
						tagList = tagList || tags;
						renderList(tags);
					});
				} else if (!val && tagList) {
					renderList(tagList);
				}
			}

			searchEl.on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').on('keyup', utils.debounce(doSearch, 300));
			doSearch();
		});

		el.on('shown.bs.dropdown', function () {
			if (!['xs', 'sm'].includes(utils.findBootstrapEnvironment())) {
				searchEl.find('input').focus();
			}
		});

		el.on('hidden.bs.dropdown', function () {
			if (toggleSearchVisibilty) {
				searchEl.addClass('hidden');
			}

			searchEl.off('click');
			searchEl.find('input').off('keyup');


			let changed = initialTags.length !== selectedTags.length;
			initialTags.forEach(function (tag, index) {
				if (tag !== selectedTags[index]) {
					changed = true;
				}
			});
			initialTags = selectedTags.slice();
			if (changed) {
				if (options.updateButton) {
					options.updateButton({ el, changed: changed, selectedTags: selectedTags.slice() });
				} else if (options.updateButton !== false) {
					updateFilterButton(el, selectedTags);
				}
			}
			if (options.onHidden) {
				options.onHidden({ changed: changed, selectedTags: selectedTags.slice() });
				return;
			}
			if (changed) {
				let url = window.location.pathname;
				const currentParams = utils.params();
				if (selectedTags.length) {
					currentParams.tag = selectedTags.length ? selectedTags : undefined;
				} else {
					delete currentParams.tag;
				}
				delete currentParams.page;
				if (Object.keys(currentParams).length) {
					url += '?' + $.param(currentParams);
				}
				ajaxify.go(url);
			}
		});

		el.on('click', '[component="tag/filter/list"] [data-tag]', function () {
			const listEl = el.find('[component="tag/filter/list"]');
			const tagEl = $(this);
			const link = tagEl.find('a').attr('href');
			if (link && link !== '#' && link.length) {
				return;
			}
			const tag = tagEl.attr('data-tag');
			const icon = tagEl.find('[component="tag/select/icon"]');

			if (tag !== '') {
				if (selectedTags.includes(tag)) {
					selectedTags.splice(selectedTags.indexOf(tag), 1);
				} else {
					selectedTags.push(tag);
				}
				selectedTags.sort(function (a, b) {
					return a - b;
				});
				icon.toggleClass('invisible');
			} else {
				el.find('[component="tag/select/icon"]').addClass('invisible');
				selectedTags = [];
			}

			listEl.find('[data-tag=""] i').toggleClass('invisible', !!selectedTags.length);
			options.selectedTags = selectedTags;
			if (options.onSelect) {
				options.onSelect({ tag: tag, selectedTags: selectedTags.slice() });
			}
			return false;
		});

		function loadList(query, callback) {
			let cids = null;
			if (ajaxify.data.template.category || ajaxify.data.template.world) {
				cids = [ajaxify.data.cid];
			// selectedCids is avaiable on /recent, /unread, /popular etc.
			} else if (Array.isArray(ajaxify.data.selectedCids) && ajaxify.data.selectedCids.length) {
				cids = ajaxify.data.selectedCids;
			}
			socket.emit('topics.tagFilterSearch', {
				query: query,
				cids: cids,
			}, function (err, data) {
				if (err) {
					return alerts.error(err);
				}
				callback(data);
			});
		}

		function renderList(tags) {
			const selectedTags = options.selectedTags;
			tags.forEach(function (tag) {
				tag.selected = selectedTags.includes(tag.value);
			});

			app.parseAndTranslate(options.template, {
				tagItems: tags.slice(0, 200),
				selectedTag: ajaxify.data.selectedTag,
			}, function (html) {
				el.find('[component="tag/filter/list"]')
					.html(html.find('[component="tag/filter/list"]').html());

				const bsDropdown = bootstrap.Dropdown.getInstance(el.find('.dropdown-toggle').get(0));
				if (bsDropdown) {
					bsDropdown.update();
				}
			});
		}
	};

	function updateFilterButton(el, selectedTags) {
		if (selectedTags.length > 0) {
			renderButton({
				label: selectedTags.join(', '),
			});
		} else {
			renderButton();
		}
		function renderButton(selectedTag) {
			app.parseAndTranslate('partials/tags/filter-dropdown-content', {
				selectedTag: selectedTag,
			}, function (html) {
				el.find('button').replaceWith($('<div/>').html(html).find('button'));
			});
		}
	}

	return tagFilter;
});
