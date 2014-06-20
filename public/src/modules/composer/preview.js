'use strict';

/* globals define, socket*/

define('composer/preview', function() {
	var preview = {};

	preview.render = function(postContainer) {

		var textarea = postContainer.find('textarea');
		socket.emit('modules.composer.renderPreview', textarea.val(), function(err, preview) {
			if (err) {
				return;
			}
			preview = $(preview);
			preview.find('img').addClass('img-responsive');
			postContainer.find('.preview').html(preview);
		});
	};

	return preview;
});