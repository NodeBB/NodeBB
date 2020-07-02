'use strict';

define('forum/account/blocks', ['forum/account/header'], function (header) {
	var Blocks = {};

	Blocks.init = function () {
		header.init();

		$('#user-search').on('keyup', function () {
			var username = this.value;

			socket.emit('user.search', {
				query: username,
				searchBy: 'username',
			}, function (err, data) {
				if (err) {
					return app.alertError(err.message);
				}

				// Only show first 10 matches
				if (data.matchCount > 10) {
					data.users.length = 10;
				}

				app.parseAndTranslate('account/blocks', 'edit', {
					edit: data.users,
				}, function (html) {
					$('.block-edit').html(html);
				});
			});
		});

		$('.block-edit').on('click', '[data-action="toggle"]', function () {
			var uid = parseInt(this.getAttribute('data-uid'), 10);
			socket.emit('user.toggleBlock', {
				blockeeUid: uid,
				blockerUid: ajaxify.data.uid,
			}, Blocks.refreshList);
		});
	};

	Blocks.refreshList = function (err) {
		if (err) {
			return app.alertError(err.message);
		}

		$.get(config.relative_path + '/api/' + ajaxify.currentPage)
			.done(function (payload) {
				app.parseAndTranslate('account/blocks', 'users', payload, function (html) {
					$('#users-container').html(html);
					$('#users-container').siblings('div.alert')[html.length ? 'hide' : 'show']();
				});
			})
			.fail(function () {
				ajaxify.go(ajaxify.currentPage);
			});
	};

	return Blocks;
});
