'use strict';

define('pictureCropper', ['alerts'], function (alerts) {
	const PictureCropper = {};

	PictureCropper.show = function (data, callback) {
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

	PictureCropper.handleImageCrop = function (data, callback) {
		$('#crop-picture-modal').remove();
		app.parseAndTranslate('modals/crop_picture', {
			url: utils.escapeHTML(data.url),
		}, async function (cropperModal) {
			cropperModal.modal({
				backdrop: 'static',
			}).modal('show');

			const cropBoxHeight = parseInt($(window).height() / 2, 10);
			const img = document.getElementById('cropped-image');
			const { Cropper } = await import(/* webpackChunkName: "cropperjs" */ 'cropperjs');
			const cropper = new Cropper(img);
			const cropperCanvas = cropper.getCropperCanvas();
			const cropperImage = cropper.getCropperImage();
			const cropperSelection = cropper.getCropperSelection();

			cropperCanvas.style.height = `${cropBoxHeight}px`;

			cropperSelection.minInset = '0';
			cropperSelection.initialCoverage = 1;
			if (data.aspectRatio) {
				cropperSelection.aspectRatio = data.aspectRatio;
			}

			// restrict the selection size to data.imageDimension (cropmove in 1.x)
			let clamping = false;
			cropperSelection.addEventListener('change', function (changeEvent) {
				if (clamping || !data.restrictImageDimension) {
					return;
				}

				const maxDimension = data.imageDimension;
				const { x, y, width, height } = changeEvent.detail;
				if (width <= maxDimension && height <= maxDimension) {
					return;
				}

				const scale = Math.min(maxDimension / width, maxDimension / height);
				const newWidth = Math.round(width * scale);
				const newHeight = Math.round(height * scale);

				clamping = true;
				cropperSelection.$change(
					Math.round(x + ((width - newWidth) / 2)),
					Math.round(y + ((height - newHeight) / 2)),
					newWidth,
					newHeight,
				);
				clamping = false;

				changeEvent.preventDefault();
			});

			cropperImage.$ready().then(async () => {
				if (!await checkCORS(cropperSelection, data)) {
					return cropperModal.modal('hide');
				}

				cropperModal.find('.rotate').on('click', function () {
					const degrees = this.getAttribute('data-degrees');
					cropperImage.$rotate(`${degrees}deg`);
				});

				cropperModal.find('.flip').on('click', function () {
					const method = this.getAttribute('data-method');

					// $scale multiplies the transform matrix, so -1 mirrors on each click
					if (method === 'scaleX') {
						cropperImage.$scale(-1, 1);
					} else {
						cropperImage.$scale(1, -1);
					}
				});

				cropperModal.find('.reset').on('click', function () {
					// resetTransform only clears the matrix, which leaves the image at its
					// natural size: re-center and re-fit it, as the fit/inset handlers do
					cropperImage.$resetTransform();
					cropperImage.$center(cropperImage.initialFit);
					cropperSelection.$reset();
				});

				cropperModal.find('.crop-btn').on('click', function () {
					$(this).addClass('disabled');
					checkCORS(cropperSelection, data).then(function (imageData) {
						if (!imageData) {
							cropperModal.find('.crop-btn').removeClass('disabled');
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
								return alerts.error(err);
							}

							callback(result.url);
							cropperModal.modal('hide');
						});
					});
				});

				// uploading the picture without cropping it: select the whole canvas
				cropperModal.find('.upload-btn').on('click', function () {
					$(this).addClass('disabled');
					cropperSelection.$change(0, 0, cropperCanvas.offsetWidth, cropperCanvas.offsetHeight, NaN, true);
					cropperModal.find('.crop-btn').trigger('click');
				});
			});

			cropperModal.on('hidden.bs.modal', function () {
				cropper.destroy();
				cropperModal.remove();
			});
		});
	};

	function socketUpload(params, callback) {
		const socketData = {};
		socketData[params.data.paramName] = params.data.paramValue;
		socketData.method = params.data.socketMethod;
		socketData.size = params.imageData.length;
		socketData.progress = 0;

		const chunkSize = 100000;
		function doUpload() {
			const chunk = params.imageData.slice(socketData.progress, socketData.progress + chunkSize);
			socket.emit('uploads.upload', {
				chunk: chunk,
				params: socketData,
			}, function (err, result) {
				if (err) {
					return callback(err);
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

	/**
	 * cropperjs 2.x has no checkCrossOrigin option: a canvas that drew a cross-origin
	 * image without CORS headers is tainted, and exporting it throws.
	 *
	 * @param {CropperSelection} cropperSelection the active selection
	 * @param {object} data the options of the crop modal
	 * @returns {Promise<string>} the data url of the cropped picture, empty on failure
	 */
	function checkCORS(cropperSelection, data) {
		const opts = {};
		if (data.restrictImageDimension) {
			opts.width = data.imageDimension;
			opts.height = data.imageDimension;
		}
		// the canvas options of 1.x are applied in beforeDraw in 2.x
		opts.beforeDraw = function (context) {
			context.imageSmoothingEnabled = true;
			context.imageSmoothingQuality = 'high';
		};

		return cropperSelection.$toCanvas(opts).then(function (canvas) {
			return data.imageType ? canvas.toDataURL(data.imageType) : canvas.toDataURL();
		}).catch(function (err) {
			const corsErrors = [
				'The operation is insecure.',
				'Failed to execute \'toDataURL\' on \'HTMLCanvasElement\': Tainted canvases may not be exported.',
			];
			if (corsErrors.indexOf(err.message) !== -1) {
				alerts.error('[[error:cors-error]]');
			} else {
				alerts.error(err.message);
			}
			return '';
		});
	}

	function onSubmit(data, callback) {
		function showAlert(type, message) {
			if (type === 'error') {
				data.uploadModal.find('#fileUploadSubmitBtn').removeClass('disabled');
			}
			data.uploadModal.find('#alert-' + type).translateText(message).removeClass('hide');
		}
		const fileInput = data.uploadModal.find('#fileInput');
		if (!fileInput.val()) {
			return showAlert('error', '[[uploads:select-file-to-upload]]');
		}

		const file = fileInput[0].files[0];
		const fileSize = data.hasOwnProperty('fileSize') && data.fileSize ? parseInt(data.fileSize, 10) : false;
		if (fileSize && file.size > fileSize * 1024) {
			return showAlert('error', '[[error:file-too-big, ' + fileSize + ']]');
		}

		if (file.name.endsWith('.gif')) {
			require(['uploader'], function (uploader) {
				uploader.ajaxSubmit(data.uploadModal, callback);
			});
			return;
		}

		const reader = new FileReader();
		reader.addEventListener('load', function () {
			const imageUrl = reader.result;

			data.uploadModal.modal('hide');

			PictureCropper.handleImageCrop({
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

	return PictureCropper;
});
