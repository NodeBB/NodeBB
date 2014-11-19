'use strict';

/* globals define, socket*/

define('composer/preview', function() {
	var preview = {};

	var timeoutId = 0;

	preview.render = function(postContainer, callback) {
		callback = callback || function() {};
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = 0;
		}
		var textarea = postContainer.find('textarea');

		timeoutId = setTimeout(function() {
			socket.emit('modules.composer.renderPreview', textarea.val(), function(err, preview) {
				timeoutId = 0;
				if (err) {
					return;
				}
				preview = $(preview);
				preview.find('img').addClass('img-responsive');
				postContainer.find('.preview').html(preview);
				$(window).trigger('action:composer.preview');
				callback();
			});
		}, 250);
	};

	preview.matchScroll = function(postContainer) {
		var textarea = postContainer.find('textarea');
		var preview = postContainer.find('.preview');
		var diff = textarea[0].scrollHeight - textarea.height();

		if (diff === 0) {
			return;
		}

		var scrollPercent = textarea.scrollTop() / diff;

		preview.scrollTop(Math.max(preview[0].scrollHeight - preview.height(), 0) * scrollPercent);
	};

	return preview;
});