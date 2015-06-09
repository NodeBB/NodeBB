'use strict';

/* globals define */

define('uploader', ['csrf'], function(csrf) {

	var module = {};

	module.open = function(route, params, fileSize, callback) {
		var uploadModal = $('#upload-picture-modal');
		uploadModal.modal('show').removeClass('hide');
		module.hideAlerts();
		var uploadForm = $('#uploadForm');
		uploadForm[0].reset();
		uploadForm.attr('action', route);
		uploadForm.find('#params').val(JSON.stringify(params));

		if (fileSize) {
			uploadForm.find('#file-size-block')
				.translateText('[[uploads:maximum-file-size, ' + fileSize + ']]')
				.removeClass('hide');
		} else {
			uploadForm.find('#file-size-block').addClass('hide');
		}

		$('#pictureUploadSubmitBtn').off('click').on('click', function() {
			uploadForm.submit();
		});

		uploadForm.off('submit').submit(function() {

			function showAlert(type, message) {
				module.hideAlerts();
				uploadModal.find('#alert-' + type).translateText(message).removeClass('hide');
			}

			showAlert('status', '[[uploads:uploading-file]]');

			uploadModal.find('#upload-progress-bar').css('width', '0%');
			uploadModal.find('#upload-progress-box').show().removeClass('hide');

			if (!$('#userPhotoInput').val()) {
				showAlert('error', '[[uploads:select-file-to-upload]]');
				return false;
			}

			$(this).ajaxSubmit({
				headers: {
					'x-csrf-token': csrf.get()
				},
				error: function(xhr) {
					xhr = maybeParse(xhr);
					showAlert('error', xhr.responseJSON ? xhr.responseJSON.error : 'error uploading, code : ' + xhr.status);
				},

				uploadProgress: function(event, position, total, percent) {
					uploadModal.find('#upload-progress-bar').css('width', percent + '%');
				},

				success: function(response) {
					response = maybeParse(response);

					if (response.error) {
						showAlert('error', response.error);
						return;
					}

					callback(response[0].url);

					showAlert('success', '[[uploads:upload-success]]');
					setTimeout(function() {
						module.hideAlerts();
						uploadModal.modal('hide');
					}, 750);
				}
			});

			return false;
		});
	};

	function maybeParse(response) {
		if (typeof response === 'string') {
			try {
				return $.parseJSON(response);
			} catch (e) {
				return {error: '[[error:parse-error]]'};
			}
		}
		return response;
	}

	module.hideAlerts = function() {
		$('#upload-picture-modal').find('#alert-status, #alert-success, #alert-error, #upload-progress-box').addClass('hide');
	};

	return module;
});
