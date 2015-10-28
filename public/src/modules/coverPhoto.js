"use strict";
/* globals define, app*/

define('coverPhoto', [
	'uploader',
	'vendor/jquery/draggable-background/backgroundDraggable'
], function(uploader) {

	var coverPhoto = {
		coverEl: null,
		getFn: null,
		saveFn: null
	};

	coverPhoto.init = function(coverEl, getFn, saveFn) {
		coverPhoto.coverEl = coverEl;
		coverPhoto.getFn = getFn;
		coverPhoto.saveFn = saveFn;

		coverEl.find('.change').on('click', function() {
			uploader.open(RELATIVE_PATH + '/api/groups/uploadpicture', { groupName: 'administrators' }, 0, function(imageUrlOnServer) {
				console.log(imageUrlOnServer);
				coverPhoto.coverEl.css('background-image', 'url(' + imageUrlOnServer + '?' + new Date().getTime() + ')');
			});

			return;
			coverEl.toggleClass('active', 1);
			coverEl.backgroundDraggable({
				axis: 'y',
				units: 'percent'
			});
			coverEl.on('dragover', coverPhoto.onDragOver);
			coverEl.on('drop', coverPhoto.onDrop);
		});

		coverEl.find('.save').on('click', coverPhoto.save);
		coverEl.addClass('initialised');
	};

	coverPhoto.load = function() {
		coverPhoto.getFn(function(err, data) {
			if (!err) {
				if (data['cover:url']) {
					coverPhoto.coverEl.css('background-image', 'url(' + data['cover:url'] + ')');
				}

				if (data['cover:position']) {
					coverPhoto.coverEl.css('background-position', data['cover:position']);
				}

				delete coverPhoto.newCover;
			} else {
				app.alertError(err.message);
			}
		});
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
				coverPhoto.load();
			} else {
				app.alertError(err.message);
			}

			coverPhoto.coverEl.removeClass('saving');
		});
	};

	return coverPhoto;
});