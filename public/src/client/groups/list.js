"use strict";
/* globals app, define, ajaxify, socket, bootbox, utils */

define('forum/groups/list', ['nodebb-templatist'], function(templatist) {
	var Groups = {};

	Groups.init = function() {
		var groupsEl = $('#groups-list');

		groupsEl.on('click', '.list-cover', function() {
			var groupSlug = $(this).parents('[data-slug]').attr('data-slug');

			ajaxify.go('groups/' + groupSlug);
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
		$('#search-text').on('keyup', Groups.search);
		$('#search-button').on('click', Groups.search);
		$('#search-sort').on('change', Groups.search);
	};

	Groups.search = function(event) {
		var groupsEl = $('#groups-list'),
			queryEl = $('#search-text'),
			sortEl = $('#search-sort');

		event.preventDefault();

		socket.emit('groups.search', {
			query: queryEl.val(),
			options: {
				expand: true,
				truncateUserList: true,
				sort: sortEl.val()
			}
		}, function(err, groups) {
			templatist.render('partials/groups/list', {
				groups: groups
			}, function(err, html) {
				groupsEl.empty().append(html);
			});
		});
	};

	return Groups;
});