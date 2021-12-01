'use strict';

define('admin/manage/uploads', ['api', 'bootbox', 'uploader'], function (api, bootbox, uploader) {
	const Uploads = {};

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
			const file = $(this).parents('[data-path]');
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

		$('#new-folder').on('click', async function () {
			bootbox.prompt('[[admin/manage/uploads:name-new-folder]]', (newFolderName) => {
				if (!newFolderName || !newFolderName.trim()) {
					return;
				}

				api.put('/files/folder', {
					path: ajaxify.data.currentFolder,
					folderName: newFolderName,
				}).then(() => {
					ajaxify.refresh();
				}).catch(app.alertError);
			});
		});
	};

	return Uploads;
});
