'use strict';


define('forum/chats/message-search', [
	'components', 'alerts', 'forum/chats/messages',
], function (components, alerts, messages) {
	const messageSearch = {};
	let roomId = 0;
	let resultListEl;
	let chatContent;
	let clearEl;

	messageSearch.init = function (_roomId) {
		roomId = _roomId;
		const searchInput = $('[component="chat/room/search"]');
		searchInput.on('keyup', utils.debounce(doSearch, 250))
			.on('focus', () => {
				if (searchInput.val()) {
					doSearch();
				}
			});
		resultListEl = $('[component="chat/message/search/results"]');
		chatContent = $('[component="chat/message/content"]');
		clearEl = $('[component="chat/room/search/clear"]');
		$('[component="chat/input"]').on('focus', () => {
			resultListEl.addClass('hidden');
			chatContent.removeClass('hidden');
		});
		clearEl.on('click', clearInputAndResults);
	};

	function clearInputAndResults() {
		components.get('chat/room/search').val('');
		removeResults();
		resultListEl.addClass('hidden');
		chatContent.removeClass('hidden');
		clearEl.addClass('hidden');
	}

	async function doSearch() {
		const query = components.get('chat/room/search').val();
		if (!query) {
			return clearInputAndResults();
		}
		if (query.length <= 2) {
			return;
		}
		clearEl.removeClass('hidden');
		socket.emit('modules.chats.searchMessages', {
			content: query,
			roomId: roomId,
		}).then(displayResults)
			.catch(alerts.error);
	}

	function removeResults() {
		resultListEl.children('[data-mid]').remove();
	}

	async function displayResults(data) {
		removeResults();

		if (!data.length) {
			resultListEl.removeClass('hidden');
			chatContent.addClass('hidden');
			return resultListEl.find('[component="chat/message/search/no-results"]').removeClass('hidden');
		}
		resultListEl.find('[component="chat/message/search/no-results"]').addClass('hidden');

		const html = await app.parseAndTranslate('partials/chats/messages', {
			messages: data,
			isAdminOrGlobalMod: app.user.isAdmin || app.user.isGlobalMod,
		});

		resultListEl.append(html);
		messages.onMessagesAddedToDom(resultListEl.find('[component="chat/message"]'));
		chatContent.addClass('hidden');
		resultListEl.removeClass('hidden');
	}

	return messageSearch;
});
