'use strict';


define('admin/manage/uploads', ['uploader', 'api'], function (uploader, api) {
	var Uploads = {};

	Uploads.init = function () {
		$('#upload').on('click', function () {
			uploader.show({
				title: '[[admin/manage/uploads:upload-file]]',
				route: config.relative_path + '/api/admin/upload/file',
				params: { folder: ajaxify.data.currentFolder },
			}, function () {
				ajaxify.refresh();
			});
		});

		$('.delete').on('click', function () {
			var file = $(this).parents('[data-path]');
			bootbox.confirm('[[admin/manage/uploads:confirm-delete]]', function (ok) {
				if (!ok) {
					return;
				}

				api.del('/files', {
					path: file.attr('data-path'),
				}).then(() => {
					file.remove();
				}).catch(app.alertError);
			});
		});
	};

	return Uploads;
});
