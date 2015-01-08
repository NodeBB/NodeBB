"use strict";
/* globals define, socket, ajaxify, app */

define('forum/groups/details', function() {
	var Details = {};

	Details.init = function() {
		var detailsPage = $('.groups');

		$('.latest-posts .content img').addClass('img-responsive');

		detailsPage.on('click', '[data-action]', function() {
			var btnEl = $(this),
				userRow = btnEl.parents('tr'),
				ownerFlagEl = userRow.find('.member-name i'),
				isOwner = !ownerFlagEl.hasClass('invisible') ? true : false,
				uid = userRow.attr('data-uid'),
				action = btnEl.attr('data-action');

			switch(action) {
				case 'toggleOwnership':
					socket.emit('groups.' + (isOwner ? 'rescind' : 'grant'), {
						toUid: uid,
						groupName: ajaxify.variables.get('group_name')
					}, function(err) {
						if (!err) {
							ownerFlagEl.toggleClass('invisible');
						} else {
							app.alertError(err);
						}
					});
					break;

				case 'join':	// intentional fall-throughs!
				case 'leave':
				case 'accept':
				case 'reject':
					socket.emit('groups.' + action, {
						toUid: uid,
						groupName: ajaxify.variables.get('group_name')
					}, function(err) {
						if (!err) {
							ajaxify.refresh();
						} else {
							app.alertError(err);
						}
					});
					break;
			}
		});
	};

	return Details;
});