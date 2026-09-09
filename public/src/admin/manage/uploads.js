'use strict';

define('admin/manage/uploads', ['api', 'modals', 'alerts', 'uploader'], function (api, modals, alerts, uploader) {
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
			modals.confirm('[[admin/manage/uploads:confirm-delete]]', function (ok) {
				if (!ok) {
					return;
				}

				api.del('/files', {
					path: file.attr('data-path'),
				}).then(() => {
					file.remove();
				}).catch(alerts.error);
			});
		});

		$('#new-folder').on('click', async function () {
			modals.prompt('[[admin/manage/uploads:name-new-folder]]', (newFolderName) => {
				if (!newFolderName || !newFolderName.trim()) {
					return;
				}

				api.put('/files/folder', {
					path: ajaxify.data.currentFolder,
					folderName: newFolderName,
				}).then(() => {
					ajaxify.refresh();
				}).catch(alerts.error);
			});
		});
	};

	return Uploads;
});
