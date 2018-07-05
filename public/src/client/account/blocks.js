'use strict';

define('forum/account/blocks', ['forum/account/header', 'autocomplete'], function (header, autocomplete) {
	var Blocks = {};

	Blocks.init = function () {
		header.init();

		autocomplete.user($('#user-search'), function (ev, ui) {
			app.parseAndTranslate('account/blocks', 'edit', {
				edit: [ui.item.user],
			}, function (html) {
				$('.block-edit').html(html);
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
