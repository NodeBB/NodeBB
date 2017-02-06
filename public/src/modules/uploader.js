'use strict';

/* globals define, ajaxify, socket, app, templates */

define('uploader', ['translator', 'cropper'], function (translator, cropper) {

	var module = {};

	module.open = function (route, params, fileSize, callback) {
		console.warn('[uploader] uploader.open() is deprecated, please use uploader.show() instead, and pass parameters as a singe option with callback, e.g. uploader.show({}, callback);');
		module.show({
			route: route,
			params: params,
			fileSize: fileSize
		}, callback);
	};

	module.show = function (data, callback) {
		var fileSize = data.hasOwnProperty('fileSize') && data.fileSize !== undefined ? parseInt(data.fileSize, 10) : false;
		parseModal({
			showHelp: data.hasOwnProperty('showHelp') && data.showHelp !== undefined ? data.showHelp : true,
			fileSize: fileSize,
			title: data.title || '[[global:upload_file]]',
			description: data.description || '',
			button: data.button || '[[global:upload]]',
			accept: data.accept ? data.accept.replace(/,/g, '&#44; ') : ''
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

		var fileInput = uploadModal.find('#fileInput');
		if (!fileInput.val()) {
			return showAlert('error', '[[uploads:select-file-to-upload]]');
		}
		
		var file    = fileInput[0].files[0];
		var reader  = new FileReader();
		var imageUrl;
		var imageType = file.type;
		
		reader.addEventListener("load", function () {
			imageUrl = reader.result;
			
			uploadModal.modal('hide');
			
			callback({url: imageUrl, imageType: imageType});
		}, false);
		
		if (file) {
			reader.readAsDataURL(file);
		}
	}

	function parseModal(tplVals, callback) {
		templates.parse('partials/modals/upload_file_modal', tplVals, function (html) {
			translator.translate(html, callback);
		});
	}

	return module;
});
