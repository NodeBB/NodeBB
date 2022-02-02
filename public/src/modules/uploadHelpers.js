'use strict';


define('uploadHelpers', ['alerts'], function (alerts) {
	const uploadHelpers = {};

	uploadHelpers.init = function (options) {
		const formEl = options.uploadFormEl;
		if (!formEl.length) {
			return;
		}
		formEl.attr('action', config.relative_path + options.route);

		if (options.dragDropAreaEl) {
			uploadHelpers.handleDragDrop({
				container: options.dragDropAreaEl,
				callback: function (upload) {
					uploadHelpers.ajaxSubmit({
						uploadForm: formEl,
						upload: upload,
						callback: options.callback,
					});
				},
			});
		}

		if (options.pasteEl) {
			uploadHelpers.handlePaste({
				container: options.pasteEl,
				callback: function (upload) {
					uploadHelpers.ajaxSubmit({
						uploadForm: formEl,
						upload: upload,
						callback: options.callback,
					});
				},
			});
		}
	};

	uploadHelpers.handleDragDrop = function (options) {
		let draggingDocument = false;
		const postContainer = options.container;
		const drop = options.container.find('.imagedrop');

		postContainer.on('dragenter', function onDragEnter() {
			if (draggingDocument) {
				return;
			}
			drop.css('top', '0px');
			drop.css('height', postContainer.height() + 'px');
			drop.css('line-height', postContainer.height() + 'px');
			drop.show();

			drop.on('dragleave', function () {
				drop.hide();
				drop.off('dragleave');
			});
		});

		drop.on('drop', function onDragDrop(e) {
			e.preventDefault();
			const files = e.originalEvent.dataTransfer.files;

			if (files.length) {
				let formData;
				if (window.FormData) {
					formData = new FormData();
					for (var i = 0; i < files.length; ++i) {
						formData.append('files[]', files[i], files[i].name);
					}
				}
				options.callback({
					files: files,
					formData: formData,
				});
			}

			drop.hide();
			return false;
		});

		function cancel(e) {
			e.preventDefault();
			return false;
		}

		$(document)
			.off('dragstart')
			.on('dragstart', function () {
				draggingDocument = true;
			})
			.off('dragend')
			.on('dragend', function () {
				draggingDocument = false;
			});

		drop.on('dragover', cancel);
		drop.on('dragenter', cancel);
	};

	uploadHelpers.handlePaste = function (options) {
		const container = options.container;
		container.on('paste', function (event) {
			const items = (event.clipboardData || event.originalEvent.clipboardData || {}).items;
			const files = [];
			const fileNames = [];
			let formData = null;
			if (window.FormData) {
				formData = new FormData();
			}
			[].forEach.call(items, function (item) {
				const file = item.getAsFile();
				if (file) {
					const fileName = utils.generateUUID() + '-' + file.name;
					if (formData) {
						formData.append('files[]', file, fileName);
					}
					files.push(file);
					fileNames.push(fileName);
				}
			});

			if (files.length) {
				options.callback({
					files: files,
					fileNames: fileNames,
					formData: formData,
				});
			}
		});
	};

	uploadHelpers.ajaxSubmit = function (options) {
		const files = [...options.upload.files];

		for (let i = 0; i < files.length; ++i) {
			const isImage = files[i].type.match(/image./);
			if ((isImage && !app.user.privileges['upload:post:image']) || (!isImage && !app.user.privileges['upload:post:file'])) {
				return alerts.error('[[error:no-privileges]]');
			}
			if (files[i].size > parseInt(config.maximumFileSize, 10) * 1024) {
				options.uploadForm[0].reset();
				return alerts.error('[[error:file-too-big, ' + config.maximumFileSize + ']]');
			}
		}
		const alert_id = Date.now();
		options.uploadForm.off('submit').on('submit', function () {
			$(this).ajaxSubmit({
				headers: {
					'x-csrf-token': config.csrf_token,
				},
				resetForm: true,
				clearForm: true,
				formData: options.upload.formData,
				error: function (xhr) {
					let errorMsg = (xhr.responseJSON &&
						(xhr.responseJSON.error || (xhr.responseJSON.status && xhr.responseJSON.status.message))) ||
						'[[error:parse-error]]';

					if (xhr && xhr.status === 413) {
						errorMsg = xhr.statusText || 'Request Entity Too Large';
					}
					alerts.error(errorMsg);
					alerts.remove(alert_id);
				},

				uploadProgress: function (event, position, total, percent) {
					alerts.alert({
						alert_id: alert_id,
						message: '[[modules:composer.uploading, ' + percent + '%]]',
					});
				},

				success: function (res) {
					const uploads = res.response.images;
					if (uploads && uploads.length) {
						for (var i = 0; i < uploads.length; ++i) {
							uploads[i].filename = files[i].name;
							uploads[i].isImage = /image./.test(files[i].type);
						}
					}
					options.callback(uploads);
				},

				complete: function () {
					options.uploadForm[0].reset();
					setTimeout(alerts.remove, 100, alert_id);
				},
			});

			return false;
		});

		options.uploadForm.submit();
	};

	return uploadHelpers;
});
