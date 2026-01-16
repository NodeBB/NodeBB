'use strict';

define('forum/groups/list', [
	'api', 'bootbox', 'alerts',
], function (api, bootbox, alerts) {
	const Groups = {};

	Groups.init = function () {
		// Group creation
		$('button[data-action="new"]').on('click', function () {
			bootbox.prompt('[[groups:new-group.group-name]]', function (name) {
				if (name && name.length) {
					api.post('/groups', {
						name: name,
					}).then((res) => {
						ajaxify.go('groups/' + res.slug);
					}).catch(alerts.error);
				}
			});
		});
		const params = utils.params();
		$('#search-sort').val(params.sort || 'alpha');

		// Group searching
		$('#search-text').on('keyup', utils.debounce(Groups.search, 200));
		$('#search-button').on('click', Groups.search);
		$('#search-sort').on('change', function () {
			ajaxify.go('groups?sort=' + $('#search-sort').val());
		});
	};

	Groups.search = function () {
		api.get('/api/groups', {
			query: $('#search-text').val(),
			sort: $('#search-sort').val(),
			filterHidden: true,
			showMembers: true,
			hideEphemeralGroups: true,
		}).then(renderSearchResults)
			.catch(alerts.error);

		return false;
	};

	function renderSearchResults(data) {
		app.parseAndTranslate('partials/paginator', {
			pagination: data.pagination,
		}).then(function (html) {
			$('.pagination-container').replaceWith(html);
		});

		const groupsEl = $('#groups-list');
		app.parseAndTranslate('partials/groups/list', {
			groups: data.groups,
		}).then(function (html) {
			groupsEl.empty().append(html);
		});
	}

	return Groups;
});
