'use strict';

/* globals define, templates, translator */

define('uploader', ['csrf'], function(csrf) {

	var module = {};

	module.open = function(route, params, fileSize, callback) {
		parseModal(function(uploadModal) {
			uploadModal = $(uploadModal);

			uploadModal.modal('show');
		 	uploadModal.on('hidden.bs.modal', function() {
				uploadModal.remove();
			});

			var uploadForm = uploadModal.find('#uploadForm');
			uploadForm.attr('action', route);
			uploadForm.find('#params').val(JSON.stringify(params));

			if (fileSize) {
				uploadForm.find('#file-size-block')
					.translateText('[[uploads:maximum-file-size, ' + fileSize + ']]')
					.removeClass('hide');
			} else {
				uploadForm.find('#file-size-block').addClass('hide');
			}

			uploadModal.find('#pictureUploadSubmitBtn').off('click').on('click', function() {
				uploadForm.submit();
			});

			uploadForm.off('submit').submit(function() {

				function showAlert(type, message) {
					module.hideAlerts(uploadModal);
					uploadModal.find('#alert-' + type).translateText(message).removeClass('hide');
				}

				showAlert('status', '[[uploads:uploading-file]]');

				uploadModal.find('#upload-progress-bar').css('width', '0%');
				uploadModal.find('#upload-progress-box').show().removeClass('hide');

				if (!uploadModal.find('#userPhotoInput').val()) {
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
		});
	};

	function parseModal(callback) {
		templates.parse('partials/modals/upload_picture_modal', {}, function(html) {
			translator.translate(html, callback);
		});
	}

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

	module.hideAlerts = function(modal) {
		modal.find('#alert-status, #alert-success, #alert-error, #upload-progress-box').addClass('hide');
	};

	return module;
});
