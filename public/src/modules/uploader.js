'use strict';


define('uploader', ['jquery-form'], function () {
	const module = {};

	module.show = function (data, callback) {
		const fileSize = data.hasOwnProperty('fileSize') && data.fileSize !== undefined ? parseInt(data.fileSize, 10) : false;
		app.parseAndTranslate('modals/upload-file', {
			showHelp: data.hasOwnProperty('showHelp') && data.showHelp !== undefined ? data.showHelp : true,
			fileSize: fileSize,
			title: data.title || '[[global:upload-file]]',
			description: data.description || '',
			button: data.button || '[[global:upload]]',
			accept: data.accept ? data.accept.replace(/,/g, '&#44; ') : '',
		}, function (uploadModal) {
			uploadModal.modal('show');
			uploadModal.on('hidden.bs.modal', function () {
				uploadModal.remove();
			});

			const uploadForm = uploadModal.find('#uploadForm');
			uploadForm.attr('action', data.route);
			uploadForm.find('#params').val(JSON.stringify(data.params));

			uploadModal.find('#fileUploadSubmitBtn').on('click', function () {
				$(this).addClass('disabled');
				uploadForm.submit();
			});

			uploadForm.submit(function () {
				onSubmit(uploadModal, fileSize, callback);
				return false;
			});
		});
	};

	module.hideAlerts = function (modal) {
		$(modal).find('#alert-status, #alert-success, #alert-error, #upload-progress-box').addClass('hide');
	};

	function onSubmit(uploadModal, fileSize, callback) {
		showAlert(uploadModal, 'status', '[[uploads:uploading-file]]');

		uploadModal.find('#upload-progress-bar').css('width', '0%');
		uploadModal.find('#upload-progress-box').show().removeClass('hide');

		const fileInput = uploadModal.find('#fileInput');
		if (!fileInput.val()) {
			return showAlert(uploadModal, 'error', '[[uploads:select-file-to-upload]]');
		}
		if (!hasValidFileSize(fileInput[0], fileSize)) {
			return showAlert(uploadModal, 'error', '[[error:file-too-big, ' + fileSize + ']]');
		}

		module.ajaxSubmit(uploadModal, callback);
	}

	function showAlert(uploadModal, type, message) {
		module.hideAlerts(uploadModal);
		if (type === 'error') {
			uploadModal.find('#fileUploadSubmitBtn').removeClass('disabled');
		}
		message = message.replace(/&amp;#44/g, '&#44');
		uploadModal.find('#alert-' + type).translateText(message).removeClass('hide');
	}

	module.ajaxSubmit = function (uploadModal, callback) {
		const uploadForm = uploadModal.find('#uploadForm');
		uploadForm.ajaxSubmit({
			headers: {
				'x-csrf-token': config.csrf_token,
			},
			error: function (xhr) {
				xhr = maybeParse(xhr);
				showAlert(
					uploadModal,
					'error',
					xhr.responseJSON?.status?.message || // apiv3
					xhr.responseJSON?.error || // { "error": "[[error:some-error]]]" }
					`[[error:upload-error-fallback, ${xhr.status} ${xhr.statusText}]]`
				);
			},
			uploadProgress: function (event, position, total, percent) {
				uploadModal.find('#upload-progress-bar').css('width', percent + '%');
			},
			success: function (response) {
				let images = maybeParse(response);

				// Appropriately handle v3 API responses
				if (response.hasOwnProperty('response') && response.hasOwnProperty('status') && response.status.code === 'ok') {
					images = response.response.images;
				}

				callback(images[0].url);

				showAlert(uploadModal, 'success', '[[uploads:upload-success]]');
				setTimeout(function () {
					module.hideAlerts(uploadModal);
					uploadModal.modal('hide');
				}, 750);
			},
		});
	};

	function maybeParse(response) {
		if (typeof response === 'string') {
			try {
				return JSON.parse(response);
			} catch (err) {
				console.error(err);
				return { error: '[[error:parse-error]]' };
			}
		}
		return response;
	}

	function hasValidFileSize(fileElement, maxSize) {
		if (window.FileReader && maxSize) {
			return fileElement.files[0].size <= maxSize * 1000;
		}
		return true;
	}

	return module;
});
