'use strict';

/* globals define, templates */

define('uploader', ['csrf', 'translator'], function(csrf, translator) {

	var module = {};

	module.open = function(route, params, fileSize, callback) {
		console.warn('[uploader] uploader.open() is deprecated, please use uploader.show() instead, and pass parameters as a singe option with callback, e.g. uploader.show({}, callback);');
		module.show({
			route: route,
			params: params,
			fileSize: fileSize
		}, callback);
	};

	module.show = function(data, callback) {
		parseModal({
			showHelp: data.hasOwnProperty('showHelp') && data.showHelp !== undefined ? data.showHelp : true,
			fileSize: data.hasOwnProperty('fileSize') && data.fileSize !== undefined ? parseInt(data.fileSize, 10) : false,
			title: data.title || '[[global:upload_file]]',
			description: data.description || '',
			button: data.button || '[[global:upload]]',
			accept: data.accept ? data.accept.replace(/,/g, '&#44;') : ''
		}, function(uploadModal) {
			uploadModal = $(uploadModal);

			uploadModal.modal('show');
		 	uploadModal.on('hidden.bs.modal', function() {
				uploadModal.remove();
			});

			var uploadForm = uploadModal.find('#uploadForm');
			uploadForm.attr('action', data.route);
			uploadForm.find('#params').val(JSON.stringify(data.params));

			uploadModal.find('#fileUploadSubmitBtn').on('click', function() {
				uploadForm.submit();
			});

			uploadForm.submit(function() {
				onSubmit(uploadModal, callback);
				return false;
			});
		});
	};

	function onSubmit(uploadModal, callback) {
		function showAlert(type, message) {
			module.hideAlerts(uploadModal);
			uploadModal.find('#alert-' + type).translateText(message).removeClass('hide');
		}

		showAlert('status', '[[uploads:uploading-file]]');

		uploadModal.find('#upload-progress-bar').css('width', '0%');
		uploadModal.find('#upload-progress-box').show().removeClass('hide');

		if (!uploadModal.find('#fileInput').val()) {
			return showAlert('error', '[[uploads:select-file-to-upload]]');
		}

		uploadModal.find('#uploadForm').ajaxSubmit({
			headers: {
				'x-csrf-token': csrf.get()
			},
			error: function(xhr) {
				xhr = maybeParse(xhr);
				showAlert('error', xhr.responseJSON ? (xhr.responseJSON.error || xhr.statusText) : 'error uploading, code : ' + xhr.status);
			},
			uploadProgress: function(event, position, total, percent) {
				uploadModal.find('#upload-progress-bar').css('width', percent + '%');
			},
			success: function(response) {
				response = maybeParse(response);

				if (response.error) {
					return showAlert('error', response.error);
				}

				callback(response[0].url);

				showAlert('success', '[[uploads:upload-success]]');
				setTimeout(function() {
					module.hideAlerts(uploadModal);
					uploadModal.modal('hide');
				}, 750);
			}
		});
	}

	function parseModal(tplVals, callback) {
		templates.parse('partials/modals/upload_file_modal', tplVals, function(html) {
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
		$(modal).find('#alert-status, #alert-success, #alert-error, #upload-progress-box').addClass('hide');
	};

	return module;
});
