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

		if (options.uploadBtnEl) {
			const fileInput = formEl.find('input[name="files[]"]');
			options.uploadBtnEl.on('click', function () {
				fileInput.trigger('click');
				return false;
			});
			fileInput.on('change', function (e) {
				const files = (e.target || {}).files ||
					($(this).val() ? [{ name: $(this).val(), type: utils.fileMimeType($(this).val()) }] : null);
				if (files) {
					uploadHelpers.ajaxSubmit({
						uploadForm: formEl,
						upload: {
							files: files,
							fileNames: Array.from(files).map(f => f.name),
						},
						callback: options.callback,
					});
				}
			});
		}
	};

	uploadHelpers.handleDragDrop = function (options) {
		let draggingDocument = false;
		const postContainer = options.container;
		const drop = options.container.find('.imagedrop');

		function onDocumentDragLeave(e) {
			// relatedTarget is null when the drag left the window or was cancelled with esc
			if (!e.originalEvent.relatedTarget) {
				hideDrop();
			}
		}

		function hideDrop() {
			drop.hide();
			drop.off('dragleave', hideDrop);
			$(document)
				.off('dragend drop', hideDrop)
				.off('dragleave', onDocumentDragLeave);
		}

		postContainer.on('dragenter', function onDragEnter() {
			if (draggingDocument || drop.is(':visible')) {
				return;
			}
			drop.css('top', '0px');
			drop.css('height', postContainer.height() + 'px');
			drop.css('line-height', postContainer.height() + 'px');
			drop.show();

			drop.on('dragleave', hideDrop);
			// the drag can end without dragleave/drop ever firing on the overlay
			// (cancelled with esc, or dropped outside of it), leaving it stuck open
			$(document)
				.on('dragend drop', hideDrop)
				.on('dragleave', onDocumentDragLeave);
		});

		drop.on('drop', function onDragDrop(e) {
			e.preventDefault();
			const files = e.originalEvent.dataTransfer.files;

			if (files.length) {
				let formData;
				if (window.FormData) {
					formData = new FormData();
					for (let i = 0; i < files.length; ++i) {
						formData.append('files[]', files[i], files[i].name);
					}
				}
				options.callback({
					files: files,
					formData: formData,
				});
			}

			hideDrop();
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
			.off('dragend mouseup')
			.on('dragend mouseup', function () {
				draggingDocument = false;
			});

		drop.on('dragover', cancel);
		drop.on('dragenter', cancel);
	};

	uploadHelpers.handlePaste = function (options) {
		const container = options.container;
		container.on('paste', async function (event) {
			const items = (event.clipboardData || event.originalEvent.clipboardData || {}).items;
			const files = [];
			const fileNames = [];
			const formData = window.FormData ? new FormData() : null;

			function addFile(file, fileName) {
				files.push(file);
				fileNames.push(fileName);
				if (formData) {
					formData.append('files[]', file, fileName);
				}
			}
			const { convertPastedImageTo } = config;
			for (const item of items) {
				const file = item.getAsFile();
				if (!file) continue;
				try {
					if (convertPastedImageTo && file.type.match(/image./) && file.type !== convertPastedImageTo) {
						// eslint-disable-next-line no-await-in-loop
						const convertedBlob = await convertImage(file, convertPastedImageTo, 0.9);
						const ext = convertedBlob.type.split('/')[1];
						const uploadName = `${utils.generateUUID()}-image.${ext}`;

						// The uuid only has to keep the upload from colliding with others in
						// the upload folder, so keep a readable name on the file itself, it is
						// what the composer labels the image with
						const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
						const convertedFile = new File([convertedBlob], `${baseName}.${ext}`, {
							type: convertedBlob.type,
						});
						addFile(convertedFile, uploadName);
					} else {
						const fileName = utils.generateUUID() + '-' + file.name;
						addFile(file, fileName);
					}
				} catch (err) {
					alerts.error(err);
					console.error(err);
				}
			}

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
			if (!app.user.isAdmin && files[i].size > parseInt(config.maximumFileSize, 10) * 1024) {
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
						errorMsg = '[[error:api.413]]';
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
						for (let i = 0; i < uploads.length; ++i) {
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

	function convertImage(file, mime, quality = 0.9) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const reader = new FileReader();

			reader.onload = e => {
				img.onload = () => {
					const canvas = document.createElement('canvas');
					canvas.width = img.width;
					canvas.height = img.height;

					const ctx = canvas.getContext('2d');
					ctx.drawImage(img, 0, 0);

					canvas.toBlob(blob => {
						if (!blob) return reject(new Error('Conversion failed'));
						resolve(blob);
					}, mime, quality);
				};

				img.onerror = reject;
				img.src = e.target.result;
			};

			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	return uploadHelpers;
});
