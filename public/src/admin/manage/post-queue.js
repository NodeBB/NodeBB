'use strict';


define('admin/manage/post-queue', function () {
	var PostQueue = {};

	PostQueue.init = function () {
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
	};

	return PostQueue;
});
