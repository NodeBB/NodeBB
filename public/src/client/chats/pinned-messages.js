'use strict';


define('forum/chats/pinned-messages', ['api', 'alerts'], function (api, alerts) {
	const pinnedMessages = {};
	let container;
	pinnedMessages.init = function (_container) {
		container = _container;
		$('[component="chat/pinned/messages/btn"]').on('click', async () => {
			const pinnedMessagesContainer = container.find('[component="chat/messages/pinned/container"]');
			if (!pinnedMessagesContainer.hasClass('hidden')) {
				return pinnedMessagesContainer.addClass('hidden');
			}
			const userListEl = container.find('[component="chat/user/list"]');
			userListEl.addClass('hidden');
			await pinnedMessages.refreshList();
			pinnedMessagesContainer.removeClass('hidden');
		});

		handleInfiniteScroll(container);
	};

	function handleInfiniteScroll(container) {
		const listEl = container.find('[component="chat/messages/pinned"]');
		listEl.on('scroll', utils.debounce(async () => {
			const bottom = (listEl[0].scrollHeight - listEl.height()) * 0.85;
			if (listEl.scrollTop() > bottom) {
				const lastIndex = listEl.find('[data-index]').last().attr('data-index');
				const data = await loadData(parseInt(lastIndex, 10) + 1);
				if (data && data.length) {
					const html = await parseMessages(data);
					container.find('[component="chat/messages/pinned"]').append(html);
				}
			}
		}, 200));
	}

	pinnedMessages.refreshList = async function () {
		const data = await loadData(0);

		if (!data.length) {
			container.find('[component="chat/messages/pinned/empty"]').removeClass('hidden');
			container.find('[component="chat/messages/pinned"]').html('');
			return;
		}
		container.find('[component="chat/messages/pinned/empty"]').addClass('hidden');
		const html = await parseMessages(data);
		container.find('[component="chat/messages/pinned"]').html(html);
		html.find('.timeago').timeago();
	};

	async function parseMessages(data) {
		return await app.parseAndTranslate('partials/chats/pinned-messages-list', 'messages', {
			isOwner: ajaxify.data.isOwner,
			isAdminOrGlobalMod: ajaxify.data.isAdminOrGlobalMod,
			messages: data,
		});
	}

	async function loadData(start) {
		const { messages } = await api.get(`/chats/${ajaxify.data.roomId}/messages/pinned`, { start });
		return messages;
	}

	pinnedMessages.pin = function (mid, roomId) {
		api.put(`/chats/${roomId}/messages/${mid}/pin`, {}).then(() => {
			$(`[component="chat/message"][data-mid="${mid}"]`).toggleClass('pinned', true);
			pinnedMessages.refreshList();
		}).catch(alerts.error);
	};

	pinnedMessages.unpin = function (mid, roomId) {
		api.del(`/chats/${roomId}/messages/${mid}/pin`, {}).then(() => {
			$(`[component="chat/message"][data-mid="${mid}"]`).toggleClass('pinned', false);
			container.find(`[component="chat/messages/pinned"] [data-mid="${mid}"]`).remove();
			if (!container.find(`[component="chat/messages/pinned"] [data-mid]`).length) {
				container.find('[component="chat/messages/pinned/empty"]').removeClass('hidden');
			}
		}).catch(alerts.error);
	};

	return pinnedMessages;
});
