"use strict";
/* globals socket, ajaxify */

define('forum/groups/details', function() {
	var Details = {};

	Details.init = function() {
		var memberList = $('.groups .members');

		$('.latest-posts .content img').addClass('img-responsive');

		memberList.on('click', '[data-action]', function() {
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
						}
					});
					break;
			}
		});
	};

	return Details;
});