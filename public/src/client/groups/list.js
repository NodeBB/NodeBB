"use strict";
/* globals app, define, ajaxify, socket, bootbox, utils, templates */

define('forum/groups/list', ['forum/infinitescroll'], function(infinitescroll) {
	var Groups = {};

	Groups.init = function() {
		var groupsEl = $('#groups-list');

		infinitescroll.init(Groups.loadMoreGroups);

		// Group creation
		$('button[data-action="new"]').on('click', function() {
			bootbox.prompt('[[groups:new-group.group_name]]', function(name) {
				if (name && name.length) {
					socket.emit('groups.create', {
						name: name
					}, function(err) {
						if (!err) {
							ajaxify.go('groups/' + utils.slugify(name));
						} else {
							app.alertError(err.message);
						}
					});
				}
			});
		});
		var params = utils.params();
		$('#search-sort').val(params.sort || 'alpha');

		// Group searching
		$('#search-text').on('keyup', Groups.search);
		$('#search-button').on('click', Groups.search);
		$('#search-sort').on('change', function() {
			ajaxify.go('groups?sort=' + $('#search-sort').val());
		});
	};

	Groups.loadMoreGroups = function(direction) {
		if (direction < 0) {
			return;
		}

		infinitescroll.loadMore('groups.loadMore', {
			sort: $('#search-sort').val(),
			after: $('[component="groups/container"]').attr('data-nextstart')
		}, function(data, done) {
			if (data && data.groups.length) {
				templates.parse('partials/groups/list', {
					groups: data.groups
				}, function(html) {
					$('#groups-list').append(html);
					done();
				});
			} else {
				done();
			}

			if (data && data.nextStart) {
				$('[component="groups/container"]').attr('data-nextstart', data.nextStart);
			}
		});
	}

	Groups.search = function() {
		var groupsEl = $('#groups-list'),
			queryEl = $('#search-text'),
			sortEl = $('#search-sort');

		socket.emit('groups.search', {
			query: queryEl.val(),
			options: {
				sort: sortEl.val(),
				filterHidden: true
			}
		}, function(err, groups) {
			if (err) {
				return app.alertError(err.message);
			}
			groups = groups.filter(function(group) {
				return group.name !== 'registered-users' && group.name !== 'guests';
			});
			templates.parse('partials/groups/list', {
				groups: groups
			}, function(html) {
				groupsEl.empty().append(html);
			});
		});
		return false;
	};

	return Groups;
});
