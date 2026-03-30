'use strict';


define('forum/chats/user-search', [
	'components', 'api', 'alerts',
], function (components, api, alerts) {
	const userSearch = {};
	let users = [];

	userSearch.init = function (options) {
		options = options || {};
		users.length = 0;
		components.get('chat/search').on('keyup', utils.debounce(doSearch, 250));
		const chatsListEl = $('[component="chat/search/list"]');
		chatsListEl.on('click', '[data-uid]', function () {
			if (options.onSelect) {
				options.onSelect(
					users.find(u => String(u.uid) === String($(this).attr('data-uid')))
				);
			}
			clearInputAndResults(chatsListEl);
		});
	};

	function clearInputAndResults(chatsListEl) {
		components.get('chat/search').val('');
		removeResults(chatsListEl);
		chatsListEl.find('[component="chat/search/no-users"]').addClass('hidden');
		chatsListEl.find('[component="chat/search/start-typing"]').removeClass('hidden');
	}

	function doSearch() {
		const chatsListEl = $('[component="chat/search/list"]');
		const username = components.get('chat/search').val();
		if (!username) {
			return clearInputAndResults(chatsListEl);
		}
		chatsListEl.find('[component="chat/search/start-typing"]').addClass('hidden');
		api.get('/api/users', {
			query: username,
			searchBy: 'username',
			paginate: false,
		}).then(displayResults)
			.catch(alerts.error);
	}

	function removeResults(chatsListEl) {
		users.length = 0;
		chatsListEl.find('[data-uid]').remove();
	}

	async function displayResults(data) {
		const chatsListEl = $('[component="chat/search/list"]');
		removeResults(chatsListEl);
		data.users = data.users.filter(function (user) {
			return parseInt(user.uid, 10) !== parseInt(app.user.uid, 10);
		});
		users = data.users;
		if (!data.users.length) {
			return chatsListEl.find('[component="chat/search/no-users"]').removeClass('hidden');
		}
		chatsListEl.find('[component="chat/search/no-users"]').addClass('hidden');
		const html = await app.parseAndTranslate('modals/create-room', 'searchUsers', { searchUsers: data.users });
		chatsListEl.append(html);
		chatsListEl.parent().toggleClass('show', true);
	}

	return userSearch;
});
