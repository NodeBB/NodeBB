'use strict';

define('forum/account/blocks', [
	'forum/account/header',
	'api',
	'hooks',
	'alerts',
], function (header, api, hooks, alerts) {
	const Blocks = {};

	Blocks.init = function () {
		header.init();
		const blockListEl = $('[component="blocks/search/list"]');
		const startTypingEl = blockListEl.find('[component="blocks/start-typing"]');
		const noUsersEl = blockListEl.find('[component="blocks/no-users"]');

		$('#user-search').on('keyup', utils.debounce(function () {
			const username = this.value;

			if (!username) {
				blockListEl.find('[component="blocks/search/match"]').remove();
				startTypingEl.removeClass('hidden');
				noUsersEl.addClass('hidden');
				return;
			}
			startTypingEl.addClass('hidden');
			api.get('/api/users', {
				query: username,
				searchBy: 'username',
				paginate: false,
			}, function (err, data) {
				if (err) {
					return alerts.error(err);
				}
				if (!data.users.length) {
					blockListEl.find('[component="blocks/search/match"]').remove();
					noUsersEl.removeClass('hidden');
					return;
				}
				noUsersEl.addClass('hidden');
				// Only show first 10 matches
				if (data.matchCount > 10) {
					data.users.length = 10;
				}

				app.parseAndTranslate('account/blocks', 'edit', {
					edit: data.users,
				}, function (html) {
					blockListEl.find('[component="blocks/search/match"]').remove();
					html.insertAfter(noUsersEl);
				});
			});
		}, 200));

		$('.block-edit').on('click', '[data-action="block"], [data-action="unblock"]', async function () {
			const uid = parseInt(this.getAttribute('data-uid'), 10);
			const action = $(this).attr('data-action');
			const currentBtn = $(this);
			await performBlock(uid, action);
			currentBtn.addClass('hidden').siblings('[data-action]').removeClass('hidden');
			Blocks.refreshList();
		});

		$('#users-container').on('click', '[data-action="unblock"]', async function () {
			await performBlock($(this).attr('data-uid'), $(this).attr('data-action'));
			Blocks.refreshList();
		});
	};

	async function performBlock(uid, action) {
		return socket.emit('user.toggleBlock', {
			blockeeUid: uid,
			blockerUid: ajaxify.data.uid,
			action: action,
		}).catch(alerts.error);
	}

	Blocks.refreshList = function () {
		$.get(config.relative_path + '/api/' + ajaxify.currentPage)
			.done(function (payload) {
				app.parseAndTranslate('account/blocks', 'users', payload, function (html) {
					html.find('.timeago').timeago();
					$('#users-container').html(html);
					$('#users-container').siblings('div.alert')[html.length ? 'hide' : 'show']();
				});
				hooks.fire('action:user.blocks.toggle', { data: payload });
			})
			.fail(function () {
				ajaxify.go(ajaxify.currentPage);
			});
	};

	return Blocks;
});
