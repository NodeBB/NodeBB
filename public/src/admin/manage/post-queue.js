'use strict';


define('admin/manage/post-queue', function () {
	var PostQueue = {};

	PostQueue.init = function () {
		$('[data-toggle="tooltip"]').tooltip();

		$('.posts-list').on('click', '[data-action]', function () {
			var parent = $(this).parents('[data-id]');
			var action = $(this).attr('data-action');
			var id = parent.attr('data-id');
			var method = action === 'accept' ? 'posts.accept' : 'posts.reject';

			socket.emit(method, { id: id }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				parent.remove();
			});
			return false;
		});

		$('.posts-list').on('click', '.post-content', function () {
			var el = $(this);
			el.addClass('hidden');
			var textareaParent = el.parent().find('.post-content-editable');
			textareaParent.removeClass('hidden').find('textarea').focus();
		});

		$('.posts-list').on('blur', '.post-content-editable textarea', function () {
			var textarea = $(this);
			var preview = textarea.parent().parent().find('.post-content');
			var id = textarea.parents('[data-id]').attr('data-id');

			socket.emit('posts.editQueuedContent', {
				id: id,
				content: textarea.val(),
			}, function (err, data) {
				if (err) {
					return app.alertError(err);
				}
				preview.html(data.postData.content);
				textarea.parent().addClass('hidden');
				preview.removeClass('hidden');
			});
		});
	};

	return PostQueue;
});
