define(function() {

	var module = {};

	module.open = function(route, callback) {
		$('#upload-picture-modal').modal('show').removeClass('hide');
		module.hideAlerts();

		$('#uploadForm')[0].reset();
		$('#uploadForm').attr('action', route);

		$('#pictureUploadSubmitBtn').off('click').on('click', function() {
			$('#uploadForm').submit();
		});

		$('#uploadForm').off('submit').submit(function() {

			function status(message) {
				module.hideAlerts();
				$('#alert-status').text(message).removeClass('hide');
			}

			function success(message) {
				module.hideAlerts();
				$('#alert-success').text(message).removeClass('hide');
			}

			function error(message) {
				module.hideAlerts();
				$('#alert-error').text(message).removeClass('hide');
			}

			status('uploading the file ...');

			$('#upload-progress-bar').css('width', '0%');
			$('#upload-progress-box').show().removeClass('hide');

			if (!$('#userPhotoInput').val()) {
				error('select an image to upload!');
				return false;
			}

			$(this).find('#imageUploadCsrf').val($('#csrf_token').val());


			$(this).ajaxSubmit({

				error: function(xhr) {
					error('Error: ' + xhr.status);
				},

				uploadProgress: function(event, position, total, percent) {
					$('#upload-progress-bar').css('width', percent + '%');
				},

				success: function(response) {
					if (response.error) {
						error(response.error);
						return;
					}
					callback(response.path);

					success('File uploaded successfully!');
					setTimeout(function() {
						module.hideAlerts();
						$('#upload-picture-modal').modal('hide');
					}, 750);
				}
			});

			return false;
		});
	}

	module.hideAlerts = function() {
		$('#alert-status').addClass('hide');
		$('#alert-success').addClass('hide');
		$('#alert-error').addClass('hide');
		$('#upload-progress-box').addClass('hide');
	}

	return module;
});