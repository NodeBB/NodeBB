define('uploader', function() {

	var module = {},
		maybeParse = function(response) {
			if (typeof response == 'string')  {
				try {
					return $.parseJSON(response);
				} catch (e) {
					return {error: 'Something went wrong while parsing server response'};
				}
			}
			return response;
		};

	module.open = function(route, params, fileSize, callback) {
		var uploadModal = $('#upload-picture-modal');
		uploadModal.modal('show').removeClass('hide');
		module.hideAlerts();
		var uploadForm = $('#uploadForm');
		uploadForm[0].reset();
		uploadForm.attr('action', route);
		uploadForm.find('#params').val(JSON.stringify(params));
		uploadForm.find('#csrfToken').val($('#csrf').attr('data-csrf'));

		if(fileSize) {
			uploadForm.find('#upload-file-size').html(fileSize);
			uploadForm.find('#file-size-block').removeClass('hide');
		} else {
			uploadForm.find('#file-size-block').addClass('hide');
		}

		$('#pictureUploadSubmitBtn').off('click').on('click', function() {
			uploadForm.submit();
		});

		uploadForm.off('submit').submit(function() {

			function status(message) {
				module.hideAlerts();
				uploadModal.find('#alert-status').text(message).removeClass('hide');
			}

			function success(message) {
				module.hideAlerts();
				uploadModal.find('#alert-success').text(message).removeClass('hide');
			}

			function error(message) {
				module.hideAlerts();
				uploadModal.find('#alert-error').text(message).removeClass('hide');
			}

			status('uploading the file ...');

			uploadModal.find('#upload-progress-bar').css('width', '0%');
			uploadModal.find('#upload-progress-box').show().removeClass('hide');

			if (!$('#userPhotoInput').val()) {
				error('select an image to upload!');
				return false;
			}

			$(this).ajaxSubmit({
				error: function(xhr) {
					xhr = maybeParse(xhr);
					error('Error: ' + xhr.status);
				},

				uploadProgress: function(event, position, total, percent) {
					uploadModal.find('#upload-progress-bar').css('width', percent + '%');
				},

				success: function(response) {
					response = maybeParse(response);

					if (response.error) {
						error(response.error);
						return;
					}
					callback(response.path);

					success('File uploaded successfully!');
					setTimeout(function() {
						module.hideAlerts();
						uploadModal.modal('hide');
					}, 750);
				}
			});

			return false;
		});
	};

	module.hideAlerts = function() {
		var uploadModal = $('#upload-picture-modal');
		uploadModal.find('#alert-status').addClass('hide');
		uploadModal.find('#alert-success').addClass('hide');
		uploadModal.find('#alert-error').addClass('hide');
		uploadModal.find('#upload-progress-box').addClass('hide');
	};

	return module;
});
