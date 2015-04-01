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

	preview.handleToggler = function(postContainer) {
		function hidePreview() {
			previewContainer.addClass('hide');
			writeContainer.addClass('maximized');
			showBtn.removeClass('hide');

			$('.write').focus();
			localStorage.setItem('composer:previewToggled', true);
		}

		function showPreview() {
			previewContainer.removeClass('hide');
			writeContainer.removeClass('maximized');
			showBtn.addClass('hide');

			$('.write').focus();
			localStorage.removeItem('composer:previewToggled');
		}

		var showBtn = postContainer.find('.write-container .toggle-preview'),
			hideBtn = postContainer.find('.preview-container .toggle-preview'),
			previewContainer = $('.preview-container'),
			writeContainer = $('.write-container');

		hideBtn.on('click', hidePreview);
		showBtn.on('click', showPreview);

		if (localStorage.getItem('composer:previewToggled')) {
			hidePreview();
		} else {
			showPreview();
		}
	};

	return preview;
});