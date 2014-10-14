"use strict";
/*global define, socket, app, admin, utils, RELATIVE_PATH*/

define('admin/manage/flags', ['forum/infinitescroll', 'admin/modules/selectable'], function(infinitescroll, selectable) {
	var	Flags = {};

	Flags.init = function() {
		$('.post-container .content img').addClass('img-responsive')
		handleDismiss();
		handleDelete();
		handleInfiniteScroll();
	};

	function handleDismiss() {
		$('.flags').on('click', '.dismiss', function() {
			var btn = $(this);
			var pid = btn.siblings('[data-pid]').attr('data-pid');

			socket.emit('admin.dismissFlag', pid, function(err) {
				done(err, btn);
			});
 		});
	}

	function handleDelete() {
		$('.flags').on('click', '.delete', function() {
			var btn = $(this);
			var pid = btn.siblings('[data-pid]').attr('data-pid');
			var tid = btn.siblings('[data-pid]').attr('data-tid');
			socket.emit('posts.delete', {pid: pid, tid: tid}, function(err) {
				done(err, btn);
			});
		});
	}

	function done(err, btn) {
		if (err) {
			return app.alertError(err.messaage);
		}
		btn.parent().fadeOut(function() {
			$(this).remove();
			if (!$('.flags [data-pid]').length) {
				$('.post-container').text('No flagged posts!');
			}
		});
	}

	function handleInfiniteScroll() {
		infinitescroll.init(function(direction) {
			if (direction < 0 && !$('.flags').length) {
				return;
			}

			infinitescroll.loadMore('admin.getMoreFlags', $('[data-next]').attr('data-next'), function(data, done) {
				if (data.posts && data.posts.length) {
					infinitescroll.parseAndTranslate('admin/manage/flags', 'posts', {posts: data.posts}, function(html) {
						$('[data-next]').attr('data-next', data.next);
						$('.post-container').append(html);
						done();
					});
				} else {
					done();
				}
			});
		});
	}

	return Flags;
});