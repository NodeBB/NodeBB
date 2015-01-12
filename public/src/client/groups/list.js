"use strict";
/* globals app, define, ajaxify, socket, bootbox */

define('forum/groups/list', function() {
	var Groups = {};

	Groups.init = function() {
		var groupsEl = $('.groups.row');

		// Group joining and leaving
		groupsEl.on('click', '[data-action]', function() {
			var action = $(this).attr('data-action'),
				groupName = $(this).parents('[data-group]').attr('data-group');

			socket.emit('groups.' + action, {
				groupName: groupName
			}, function(err) {
				if (!err) {
					ajaxify.refresh();
				}
			});
		});

		// Group creation
		$('button[data-action="new"]').on('click', function() {
			bootbox.prompt('Group Name:', function(name) {
				if (name && name.length) {
					socket.emit('groups.create', {
						name: name
					}, function(err) {
						if (!err) {
							ajaxify.go('groups/' + name);
						} else {
							app.alertError(err.message);
						}
					});
				}
			});
		});
	};

	return Groups;
});