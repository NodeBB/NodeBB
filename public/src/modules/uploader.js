'use strict';


define('uploader', ['translator', 'benchpress'], function (translator, Benchpress) {
	var module = {};

	module.show = function (data, callback) {
		var fileSize = data.hasOwnProperty('fileSize') && data.fileSize !== undefined ? parseInt(data.fileSize, 10) : false;
		parseModal({
			showHelp: data.hasOwnProperty('showHelp') && data.showHelp !== undefined ? data.showHelp : true,
			fileSize: fileSize,
			title: data.title || '[[global:upload_file]]',
			description: data.description || '',
			button: data.button || '[[global:upload]]',
			accept: data.accept ? data.accept.replace(/,/g, '&#44; ') : '',
		}, function (uploadModal) {
			uploadModal = $(uploadModal);

			uploadModal.modal('show');
			uploadModal.on('hidden.bs.modal', function () {
				uploadModal.remove();
			});

			var uploadForm = uploadModal.find('#uploadForm');
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
		function showAlert(type, message) {
			module.hideAlerts(uploadModal);
			if (type === 'error') {
				uploadModal.find('#fileUploadSubmitBtn').removeClass('disabled');
			}
			uploadModal.find('#alert-' + type).translateText(message).removeClass('hide');
		}

		showAlert('status', '[[uploads:uploading-file]]');

		uploadModal.find('#upload-progress-bar').css('width', '0%');
		uploadModal.find('#upload-progress-box').show().removeClass('hide');

		var fileInput = uploadModal.find('#fileInput');
		if (!fileInput.val()) {
			return showAlert('error', '[[uploads:select-file-to-upload]]');
		}
		if (!hasValidFileSize(fileInput[0], fileSize)) {
			return showAlert('error', '[[error:file-too-big, ' + fileSize + ']]');
		}

		uploadModal.find('#uploadForm').ajaxSubmit({
			headers: {
				'x-csrf-token': config.csrf_token,
			},
			error: function (xhr) {
				xhr = maybeParse(xhr);
				showAlert('error', xhr.responseJSON ? (xhr.responseJSON.error || xhr.statusText) : 'error uploading, code : ' + xhr.status);
			},
			uploadProgress: function (event, position, total, percent) {
				uploadModal.find('#upload-progress-bar').css('width', percent + '%');
			},
			success: function (response) {
				response = maybeParse(response);

				if (response.error) {
					return showAlert('error', response.error);
				}

				callback(response[0].url);

				showAlert('success', '[[uploads:upload-success]]');
				setTimeout(function () {
					module.hideAlerts(uploadModal);
					uploadModal.modal('hide');
				}, 750);
			},
		});
	}

	function parseModal(tplVals, callback) {
		Benchpress.parse('partials/modals/upload_file_modal', tplVals, function (html) {
			translator.translate(html, callback);
		});
	}

	function maybeParse(response) {
		if (typeof response === 'string') {
			try {
				return $.parseJSON(response);
			} catch (e) {
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
