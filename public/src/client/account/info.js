'use strict';

/* globals define, socket, ajaxify, app */

define('forum/account/info', ['forum/account/header'], function(header) {
	var Info = {};

	Info.init = function() {
		header.init();
		handleModerationNote();
	};

	function handleModerationNote() {
		$('[component="account/save-moderation-note"]').on('click', function() {
			var note = $('[component="account/moderation-note"]').val();
			socket.emit('user.setModerationNote', {uid: ajaxify.data.uid, note: note}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[user:info.moderation-note.success]]');
			});
		});
	}

	return Info;
});
