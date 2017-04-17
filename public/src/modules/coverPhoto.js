'use strict';


define('coverPhoto', [
	'vendor/jquery/draggable-background/backgroundDraggable',
], function () {
	var coverPhoto = {
		coverEl: null,
		saveFn: null,
	};

	coverPhoto.init = function (coverEl, saveFn, uploadFn, removeFn) {
		coverPhoto.coverEl = coverEl;
		coverPhoto.saveFn = saveFn;

		coverEl.find('.upload').on('click', uploadFn);
		coverEl.find('.resize').on('click', function () {
			enableDragging(coverEl);
		});
		coverEl.find('.remove').on('click', removeFn);

		coverEl
			.on('dragover', coverPhoto.onDragOver)
			.on('drop', coverPhoto.onDrop);

		coverEl.find('.save').on('click', coverPhoto.save);
		coverEl.addClass('initialised');
	};

	coverPhoto.onDragOver = function (e) {
		e.stopPropagation();
		e.preventDefault();
		e.originalEvent.dataTransfer.dropEffect = 'copy';
	};

	coverPhoto.onDrop = function (e) {
		e.stopPropagation();
		e.preventDefault();

		var files = e.originalEvent.dataTransfer.files;
		var reader = new FileReader();

		if (files.length && files[0].type.match('image.*')) {
			reader.onload = function (e) {
				coverPhoto.coverEl.css('background-image', 'url(' + e.target.result + ')');
				coverPhoto.newCover = e.target.result;
			};

			reader.readAsDataURL(files[0]);
			enableDragging(coverPhoto.coverEl);
		}
	};

	function enableDragging(coverEl) {
		coverEl.toggleClass('active', 1)
			.backgroundDraggable({
				axis: 'y',
				units: 'percent',
			});

		app.alert({
			alert_id: 'drag_start',
			title: '[[modules:cover.dragging_title]]',
			message: '[[modules:cover.dragging_message]]',
			timeout: 5000,
		});
	}

	coverPhoto.save = function () {
		coverPhoto.coverEl.addClass('saving');

		coverPhoto.saveFn(coverPhoto.newCover || undefined, coverPhoto.coverEl.css('background-position'), function (err) {
			if (!err) {
				coverPhoto.coverEl.toggleClass('active', 0);
				coverPhoto.coverEl.backgroundDraggable('disable');
				coverPhoto.coverEl.off('dragover', coverPhoto.onDragOver);
				coverPhoto.coverEl.off('drop', coverPhoto.onDrop);
				app.alertSuccess('[[modules:cover.saved]]');
			} else {
				app.alertError(err.message);
			}

			coverPhoto.coverEl.removeClass('saving');
		});
	};

	return coverPhoto;
});
