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

			var uploadForm = uploadModal.find('#uploadForm');
			if (data.route) {
				uploadForm.attr('action', data.route);
			}

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
				checkCrossOrigin: true,
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

						cropperModal.find('#upload-progress-bar').css('width', '0%');
						cropperModal.find('#upload-progress-box').show().removeClass('hide');

						socketUpload({
							data: data,
							imageData: imageData,
							progressBarEl: cropperModal.find('#upload-progress-bar'),
						}, function (err, result) {
							if (err) {
								cropperModal.find('#upload-progress-box').hide();
								cropperModal.find('.upload-btn').removeClass('disabled');
								cropperModal.find('.crop-btn').removeClass('disabled');
								return app.alertError(err.message);
							}

							callback(result.url);
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

	function socketUpload(params, callback) {
		var socketData = {};
		socketData[params.data.paramName] = params.data.paramValue;
		socketData.method = params.data.socketMethod;
		socketData.size = params.imageData.length;
		socketData.progress = 0;

		var chunkSize = 100000;
		function doUpload() {
			var chunk = params.imageData.slice(socketData.progress, socketData.progress + chunkSize);
			socket.emit('uploads.upload', {
				chunk: chunk,
				params: socketData,
			}, function (err, result) {
				if (err) {
					return app.alertError(err);
				}

				if (socketData.progress + chunkSize < socketData.size) {
					socketData.progress += chunk.length;
					params.progressBarEl.css('width', (socketData.progress / socketData.size * 100).toFixed(2) + '%');
					return setTimeout(doUpload, 100);
				}
				params.progressBarEl.css('width', '100%');
				callback(null, result);
			});
		}
		doUpload();
	}

	function checkCORS(cropperTool, data) {
		var imageData;
		try {
			imageData = data.imageType ?
				cropperTool.getCroppedCanvas().toDataURL(data.imageType) :
				cropperTool.getCroppedCanvas().toDataURL();
		} catch (err) {
			var corsErrors = [
				'The operation is insecure.',
				'Failed to execute \'toDataURL\' on \'HTMLCanvasElement\': Tainted canvases may not be exported.',
			];
			if (corsErrors.indexOf(err.message) !== -1) {
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
		var fileSize = data.hasOwnProperty('fileSize') && data.fileSize !== undefined ? parseInt(data.fileSize, 10) : false;
		if (fileSize && file.size > fileSize * 1024) {
			return showAlert('error', '[[error:file-too-big, ' + fileSize + ']]');
		}

		if (file.name.endsWith('.gif')) {
			require(['uploader'], function (uploader) {
				uploader.ajaxSubmit(data.uploadModal, callback);
			});
			return;
		}

		var reader = new FileReader();
		reader.addEventListener('load', function () {
			var imageUrl = reader.result;

			data.uploadModal.modal('hide');

			module.handleImageCrop({
				url: imageUrl,
				imageType: file.type,
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
