'use strict';


define('forum/chats/message-search', [
	'components', 'alerts', 'forum/chats/messages',
], function (components, alerts, messages) {
	const messageSearch = {};
	let roomId = 0;
	let searchInputEl;
	let resultListEl;
	let chatContent;
	let clearEl;
	let toggleEl;
	let searchContainerEl;
	messageSearch.init = function (_roomId, containerEl) {
		roomId = _roomId;

		resultListEl = containerEl.find('[component="chat/message/search/results"]');
		chatContent = containerEl.find('[component="chat/message/content"]');
		clearEl = containerEl.find('[component="chat/room/search/clear"]');
		searchContainerEl = containerEl.find('[component="chat/room/search/container"]');
		toggleEl = containerEl.find('[component="chat/room/search/toggle"');

		searchInputEl = containerEl.find('[component="chat/room/search"]');
		searchInputEl.on('keyup', utils.debounce(doSearch, 250))
			.on('focus', () => {
				if (searchInputEl.val()) {
					doSearch();
				}
			});

		containerEl.find('[component="chat/input"]').on('focus', () => {
			resultListEl.addClass('hidden');
			chatContent.removeClass('hidden');
		});
		clearEl.on('click', clearInputAndResults);

		toggleEl.on('click', () => {
			searchContainerEl.removeClass('hidden');
			toggleEl.addClass('hidden');
			searchInputEl.trigger('focus');
		});
		searchInputEl.on('blur', () => {
			if (!searchInputEl.val()) {
				clearInputAndResults();
			}
		});
	};

	function clearInputAndResults() {
		searchInputEl.val('');
		removeResults();
		resultListEl.addClass('hidden');
		clearEl.addClass('hidden');
		searchContainerEl.addClass('hidden');
		chatContent.removeClass('hidden');
		toggleEl.removeClass('hidden');
	}

	async function doSearch() {
		const query = searchInputEl.val();
		if (!query || query.length <= 2) {
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

		if (!data.messages.length) {
			resultListEl.removeClass('hidden');
			chatContent.addClass('hidden');
			return resultListEl.find('[component="chat/message/search/no-results"]').removeClass('hidden');
		}
		resultListEl.find('[component="chat/message/search/no-results"]').addClass('hidden');

		const html = await app.parseAndTranslate('partials/chats/messages', {
			messages: data.messages,
			isAdminOrGlobalMod: app.user.isAdmin || app.user.isGlobalMod,
		});

		resultListEl.append(html);
		messages.onMessagesAddedToDom(resultListEl.find('[component="chat/message"]'));
		chatContent.addClass('hidden');
		resultListEl.removeClass('hidden');
	}

	return messageSearch;
});
