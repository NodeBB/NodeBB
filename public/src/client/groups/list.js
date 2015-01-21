"use strict";
/* globals app, define, ajaxify, socket, bootbox, utils */

define('forum/groups/list', function() {
	var Groups = {};

	Groups.init = function() {
		var groupsEl = $('.groups.row');

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
	};

	return Groups;
});