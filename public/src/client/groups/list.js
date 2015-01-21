"use strict";
/* globals app, define, ajaxify, socket, bootbox, utils, templates */

define('forum/groups/list', function() {
	var Groups = {};

	Groups.init = function() {
		var groupsEl = $('#groups-list');

		groupsEl.on('click', '.list-cover', function() {
			var groupName = $(this).parents('[data-group]').attr('data-group');

			ajaxify.go('groups/' + utils.slugify(groupName));
		});

		// Group creation
		$('button[data-action="new"]').on('click', function() {
			bootbox.prompt('Group Name:', function(name) {
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

		// Group searching
		$('#search-text').on('keydown', function(e) {
			if (e.keyCode === 13) { Groups.search($(this).val()); }
		});

		$('#search-button').on('click', function() {
			Groups.search($(this).siblings('input').val());
		});
	};

	Groups.search = function(query) {
		var groupsEl = $('#groups-list');

		socket.emit('groups.search', {
			query: query,
			options: {
				expand: true
			}
		}, function(err, groups) {
			templates.parse('partials/groups/list', {
				groups: groups
			}, function(html) {
				groupsEl.empty().append(html);
			});
		});
	};

	return Groups;
});