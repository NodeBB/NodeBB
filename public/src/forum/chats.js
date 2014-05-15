'use strict';

/* globals define, app*/

define(function() {
	var Chats = {};

	Chats.init = function() {

		$('.chats-list').on('click', 'li', function(e) {
			app.openChat($(this).attr('data-username'), $(this).attr('data-uid'));
		});
	};

	return Chats;
});
