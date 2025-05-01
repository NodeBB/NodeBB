'use strict';

define('userFilter', ['api', 'hooks', 'slugify', 'benchpress'], function (api, hooks, slugify, benchpress) {
	const userFilter = {};

	userFilter.init = function (el, options) {
		if (!el || !el.length) {
			return;
		}
		options = options || {};

		let placeholderHtml;
		let selectedUsers = [];
		if (options.selectedUsers) {
			selectedUsers = options.selectedUsers.map(u => ({ ...u }));
		}
		hooks.fire('action:user.filter.options', { el: el, options: options });

		async function renderSelectedUsers() {
			const block = options.selectedBlock || 'userFilterSelected';
			const payload = {};

			// This allows `selectedBlock` to be a nested object via dot notation.
			// It's hacky and only works one level.
			if (block.indexOf('.') !== -1) {
				const split = block.split('.');
				payload[split[0]] = {};
				payload[split[0]][split[1]] = selectedUsers;
			} else {
				payload[block] = selectedUsers;
			}

			const html = await app.parseAndTranslate(options.template, block, payload);
			el.find('[component="user/filter/selected"]').html(html);
		}

		async function onSelectionChange() {
			await renderSelectedUsers();
			if (options.onSelect) {
				options.onSelect(selectedUsers);
			}
		}

		async function doSearch() {
			let result = { users: [] };
			const query = el.find('[component="user/filter/search"]').val();
			if (query && query.length > 1) {
				if (app.user.privileges['search:users']) {
					result = await api.get('/api/users', { query: query });
				} else {
					try {
						const userData = await api.get(`/api/user/${slugify(query)}`);
						result.users.push(userData);
					} catch (err) {
						console.error(err);
					}
				}
			}
			if (!result.users.length) {
				el.find('[component="user/filter/results"]').translateHtml(
					'[[users:no-users-found]]'
				);
				return;
			}
			result.users = result.users.slice(0, 20);
			const uidToUser = {};
			result.users.forEach((user) => {
				uidToUser[user.uid] = user;
			});

			const html = await app.parseAndTranslate(options.template, 'userFilterResults', {
				userFilterResults: result.users,
			});
			el.find('[component="user/filter/results"]').html(html);

			el.find('[component="user/filter/results"] [data-uid]').on('click', async function () {
				const clickedUid = parseInt($(this).attr('data-uid'), 10);
				if (!selectedUsers.find(u => u.uid === clickedUid)) {
					selectedUsers.push(uidToUser[clickedUid]);
					await onSelectionChange();
				}
			});
		}

		el.find('[component="user/filter/search"]').on('keyup', () => {
			el.find('[component="user/filter/results"]').html(placeholderHtml);
		});

		el.find('[component="user/filter/search"]').on('keyup', utils.debounce(function () {
			if (app.user.privileges['search:users']) {
				doSearch();
			}
		}, 1000));

		el.on('click', '[component="user/filter/delete"]', async function () {
			const uid = $(this).attr('data-uid');
			selectedUsers = selectedUsers.filter(u => parseInt(u.uid, 10) !== parseInt(uid, 10));
			await onSelectionChange();
		});

		el.find('[component="user/filter/search"]').on('keyup', (e) => {
			if (e.key === 'Enter' && !app.user.privileges['search:users']) {
				doSearch();
			}
		});

		el.on('shown.bs.dropdown', function () {
			el.find('[component="user/filter/search"]').trigger('focus');
		});

		el.on('hidden.bs.dropdown', function () {
			if (options.onHidden) {
				options.onHidden(selectedUsers);
			}
		});

		// Pre-render placeholders for search
		benchpress.render(options.placeholderTemplate || 'partials/userFilter-placeholders').then((html) => {
			placeholderHtml = html;
		});
	};

	return userFilter;
});
