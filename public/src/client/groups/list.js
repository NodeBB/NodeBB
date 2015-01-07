"use strict";
/* globals define, ajaxify, socket */

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
	};

	return Groups;
});