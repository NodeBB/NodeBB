"use strict";
/* globals define, app */

define('coverPhoto', [
	'vendor/jquery/draggable-background/backgroundDraggable'
], function() {

	var coverPhoto = {
		coverEl: null,
		saveFn: null
	};

	coverPhoto.init = function(coverEl, saveFn, uploadFn) {
		coverPhoto.coverEl = coverEl;
		coverPhoto.saveFn = saveFn;

		coverEl.find('.upload').on('click', uploadFn);
		coverEl.find('.resize').on('click', function() {
			coverEl
				.toggleClass('active', 1)
				.backgroundDraggable({
					axis: 'y',
					units: 'percent'
				});
		});

		coverEl
			.on('dragover', coverPhoto.onDragOver)
			.on('drop', coverPhoto.onDrop);

		coverEl.find('.save').on('click', coverPhoto.save);
		coverEl.addClass('initialised');
	};

	coverPhoto.onDragOver = function(e) {
		e.stopPropagation();
		e.preventDefault();
		e.originalEvent.dataTransfer.dropEffect = 'copy';
	};

	coverPhoto.onDrop = function(e) {
		e.stopPropagation();
		e.preventDefault();

		var files = e.originalEvent.dataTransfer.files,
		reader = new FileReader();

		if (files.length && files[0].type.match('image.*')) {
			reader.onload = function(e) {
				coverPhoto.coverEl.css('background-image', 'url(' + e.target.result + ')');
				coverPhoto.newCover = e.target.result;
			};

			reader.readAsDataURL(files[0]);

			coverPhoto.coverEl
				.addClass('active', 1)
				.backgroundDraggable({
					axis: 'y',
					units: 'percent'
				});
		}
	};

	coverPhoto.save = function() {
		coverPhoto.coverEl.addClass('saving');

		coverPhoto.saveFn(coverPhoto.newCover || undefined, coverPhoto.coverEl.css('background-position'), function(err) {
			if (!err) {
				coverPhoto.coverEl.toggleClass('active', 0);
				coverPhoto.coverEl.backgroundDraggable('disable');
				coverPhoto.coverEl.off('dragover', coverPhoto.onDragOver);
				coverPhoto.coverEl.off('drop', coverPhoto.onDrop);
			} else {
				app.alertError(err.message);
			}

			coverPhoto.coverEl.removeClass('saving');
		});
	};

	return coverPhoto;
});