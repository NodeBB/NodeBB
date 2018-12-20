'use strict';

define('pictureCropper', ['cropper'], function (Cropper) {
	var module = {};

	module.show = function (data, callback) {
		var fileSize = data.hasOwnProperty('fileSize') && data.fileSize !== undefined ? parseInt(data.fileSize, 10) : false;
		app.parseAndTranslate('partials/modals/upload_file_modal', {
			showHelp: data.hasOwnProperty('showHelp') && data.showHelp !== undefined ? data.showHelp : true,
			fileSize: fileSize,
			title: data.title || '[[global:upload_file]]',
			description: data.description || '',
			button: data.button || '[[global:upload]]',
			accept: data.accept ? data.accept.replace(/,/g, '&#44; ') : '',
		}, function (uploadModal) {
			uploadModal.modal('show');
			uploadModal.on('hidden.bs.modal', function () {
				uploadModal.remove();
			});

			uploadModal.find('#fileUploadSubmitBtn').on('click', function () {
				$(this).addClass('disabled');
				data.uploadModal = uploadModal;
				onSubmit(data, callback);
				return false;
			});
		});
	};

	module.handleImageCrop = function (data, callback) {
		$('#crop-picture-modal').remove();
		app.parseAndTranslate('modals/crop_picture', {
			url: utils.escapeHTML(data.url),
		}, function (cropperModal) {
			cropperModal.modal({
				backdrop: 'static',
			}).modal('show');

			// Set cropper image max-height based on viewport
			var cropBoxHeight = parseInt($(window).height() / 2, 10);
			var img = document.getElementById('cropped-image');
			$(img).css('max-height', cropBoxHeight);

			var cropperTool = new Cropper(img, {
				aspectRatio: data.aspectRatio,
				autoCropArea: 1,
				viewMode: 1,
				checkCrossOrigin: false,
				cropmove: function () {
					if (data.restrictImageDimension) {
						if (cropperTool.cropBoxData.width > data.imageDimension) {
							cropperTool.setCropBoxData({
								width: data.imageDimension,
							});
						}
						if (cropperTool.cropBoxData.height > data.imageDimension) {
							cropperTool.setCropBoxData({
								height: data.imageDimension,
							});
						}
					}
				},
				ready: function () {
					if (!checkCORS(cropperTool, data)) {
						return cropperModal.modal('hide');
					}

					if (data.restrictImageDimension) {
						var origDimension = (img.width < img.height) ? img.width : img.height;
						var dimension = (origDimension > data.imageDimension) ? data.imageDimension : origDimension;
						cropperTool.setCropBoxData({
							width: dimension,
							height: dimension,
						});
					}

					cropperModal.find('.rotate').on('click', function () {
						var degrees = this.getAttribute('data-degrees');
						cropperTool.rotate(degrees);
					});

					cropperModal.find('.flip').on('click', function () {
						var option = this.getAttribute('data-option');
						var method = this.getAttribute('data-method');
						if (method === 'scaleX') {
							cropperTool.scaleX(option);
						} else {
							cropperTool.scaleY(option);
						}
						this.setAttribute('data-option', option * -1);
					});

					cropperModal.find('.reset').on('click', function () {
						cropperTool.reset();
					});

					cropperModal.find('.crop-btn').on('click', function () {
						$(this).addClass('disabled');
						var imageData = checkCORS(cropperTool, data);
						if (!imageData) {
							return;
						}

						cropperModal.find('#upload-progress-bar').css('width', '100%');
						cropperModal.find('#upload-progress-box').show().removeClass('hide');

						var socketData = {};
						socketData[data.paramName] = data.paramValue;
						socketData.imageData = imageData;

						socket.emit(data.socketMethod, socketData, function (err, imageData) {
							if (err) {
								cropperModal.find('#upload-progress-box').hide();
								cropperModal.find('.upload-btn').removeClass('disabled');
								cropperModal.find('.crop-btn').removeClass('disabled');
								return app.alertError(err.message);
							}

							callback(imageData.url);
							cropperModal.modal('hide');
						});
					});

					cropperModal.find('.upload-btn').on('click', function () {
						$(this).addClass('disabled');
						cropperTool.destroy();

						cropperTool = new Cropper(img, {
							viewMode: 1,
							autoCropArea: 1,
							ready: function () {
								cropperModal.find('.crop-btn').trigger('click');
							},
						});
					});
				},
			});
		});
	};

	function checkCORS(cropperTool, data) {
		var imageData;
		try {
			imageData = data.imageType ? cropperTool.getCroppedCanvas().toDataURL(data.imageType) : cropperTool.getCroppedCanvas().toDataURL();
		} catch (err) {
			if (err.message === 'Failed to execute \'toDataURL\' on \'HTMLCanvasElement\': Tainted canvases may not be exported.') {
				app.alertError('[[error:cors-error]]');
			} else {
				app.alertError(err.message);
			}
			return;
		}
		return imageData;
	}

	function onSubmit(data, callback) {
		function showAlert(type, message) {
			if (type === 'error') {
				data.uploadModal.find('#fileUploadSubmitBtn').removeClass('disabled');
			}
			data.uploadModal.find('#alert-' + type).translateText(message).removeClass('hide');
		}
		var fileInput = data.uploadModal.find('#fileInput');
		if (!fileInput.val()) {
			return showAlert('error', '[[uploads:select-file-to-upload]]');
		}

		var file = fileInput[0].files[0];
		var reader = new FileReader();
		var imageUrl;
		var imageType = file.type;
		var fileSize = data.hasOwnProperty('fileSize') && data.fileSize !== undefined ? parseInt(data.fileSize, 10) : false;
		if (fileSize && file.size > fileSize * 1024) {
			return app.alertError('[[error:file-too-big, ' + fileSize + ']]');
		}
		reader.addEventListener('load', function () {
			imageUrl = reader.result;

			data.uploadModal.modal('hide');

			module.handleImageCrop({
				url: imageUrl,
				imageType: imageType,
				socketMethod: data.socketMethod,
				aspectRatio: data.aspectRatio,
				allowSkippingCrop: data.allowSkippingCrop,
				restrictImageDimension: data.restrictImageDimension,
				imageDimension: data.imageDimension,
				paramName: data.paramName,
				paramValue: data.paramValue,
			}, callback);
		}, false);

		if (file) {
			reader.readAsDataURL(file);
		}
	}

	return module;
});
