'use strict';

define('forum/groups/memberlist', [
	'api', 'modals', 'alerts', 'helpers', 'benchpress',
], function (api, modals, alerts, helpers, Benchpress) {
	const MemberList = {};
	let templateName;

	MemberList.init = function (_templateName) {
		templateName = _templateName || 'groups/details';

		handleMemberAdd();
		handleMemberSearch();
		handleMemberInfiniteScroll();
	};

	MemberList.refresh = async function (data) {
		const { group } = data || await api.get(`/api/groups/${ajaxify.data.group.slug}`);
		const html = await parseAndTranslate(group.members);
		$('[component="groups/members"] tbody').html(html);
		$('[component="group/member/count"]').text(
			helpers.humanReadableNumber(group.memberCount)
		);
		$('[component="group/pending/count"]').text(
			helpers.humanReadableNumber(group.pending.length)
		);
		$('[component="group/invited/count"]').text(
			helpers.humanReadableNumber(group.invited.length)
		);
		ajaxify.data.group.members = group.members;
		ajaxify.data.group.memberCount = group.memberCount;
		ajaxify.data.group.invited = group.invited;
		ajaxify.data.group.pending = group.pending;
	};

	function handleMemberAdd() {
		$('[component="groups/members/add"]').on('click', async function () {
			const isAdminGroup = ajaxify.data.group.slug === 'administrators';
			if (isAdminGroup) {
				await api.post('/users/reauth/verify');
			}
			Benchpress.render('admin/partials/groups/add-members', {}).then(async function (html) {
				const foundUsers = [];
				const modal = await modals.dialog({
					title: '[[groups:details.add-member]]',
					message: html,
					buttons: {
						OK: {
							label: '[[groups:details.add-member]]',
							callback: function () {
								const users = [];
								modal.find('[data-uid][data-selected]').each(function (index, el) {
									users.push(foundUsers[$(el).attr('data-uid')]);
								});
								addUsersToGroup(users).then(() => {
									modal.modal('hide');
								});
							},
						},
					},
				});
				modal.on('click', '[data-username]', function () {
					const isSelected = $(this).attr('data-selected') === '1';
					if (isSelected) {
						$(this).removeAttr('data-selected');
					} else {
						$(this).attr('data-selected', 1);
					}
					$(this).find('i').toggleClass('invisible');
				});
				modal.find('input').on('keyup', function () {
					api.get('/api/users', {
						query: $(this).val(),
						paginate: false,
					}, function (err, result) {
						if (err) {
							return alerts.error(err);
						}
						result.users.forEach(function (user) {
							foundUsers[user.uid] = user;
						});
						app.parseAndTranslate('admin/partials/groups/add-members', 'users', { users: result.users }, function (html) {
							modal.find('#search-result').html(html);
						});
					});
				});
			});
		});
	}

	async function addUsersToGroup(users) {
		let addedUsers = [];
		for (const user of users) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await api.put(`/groups/${ajaxify.data.group.slug}/membership/${user.uid}`);
				addedUsers.push(user);
			} catch (err) {
				alerts.error(err);
			}
		}
		const membersEl = $('[component="groups/members"]');
		addedUsers = addedUsers.filter(user => !membersEl.find(`[data-uid="${user.uid}"]`).length);
		const html = await parseAndTranslate(addedUsers);
		$('[component="groups/members"] tbody').prepend(html);
	}

	function handleMemberSearch() {
		const searchEl = $('[component="groups/members/search"]');
		searchEl.on('keyup', utils.debounce(async function () {
			const query = searchEl.val();
			const results = await api.get(`/groups/${ajaxify.data.group.slug}/members`, { query });
			const html = await parseAndTranslate(results.users);
			$('[component="groups/members"] tbody').html(html);
			$('[component="groups/members"]').attr('data-nextstart', 20);
		}, 250));
	}

	function handleMemberInfiniteScroll() {
		$('[component="groups/members"]').on('scroll', utils.debounce(function () {
			const $this = $(this);
			const bottom = ($this[0].scrollHeight - $this.innerHeight()) * 0.9;

			if ($this.scrollTop() > bottom && !$('[component="groups/members/search"]').val()) {
				loadMoreMembers();
			}
		}, 250));
	}

	async function loadMoreMembers() {
		const members = $('[component="groups/members"]');
		if (members.attr('loading')) {
			return;
		}

		members.attr('loading', 1);
		const data = await api.get(`/groups/${ajaxify.data.group.slug}/members`, {
			after: members.attr('data-nextstart'),
		}).catch(alerts.error);

		if (data && data.users.length) {
			await onMembersLoaded(data.users);
			members.removeAttr('loading');
			members.attr('data-nextstart', data.nextStart);
		} else {
			members.removeAttr('loading');
		}
	}

	async function onMembersLoaded(users) {
		users = users.filter(function (user) {
			return !$('[component="groups/members"] [data-uid="' + user.uid + '"]').length;
		});

		const html = await parseAndTranslate(users);
		$('[component="groups/members"] tbody').append(html);
	}

	async function parseAndTranslate(users) {
		return await app.parseAndTranslate(templateName, 'group.members', {
			group: {
				members: users,
				isOwner: ajaxify.data.group.isOwner,
			},
		});
	}

	MemberList.toggleOwnership = async function (groupslug, uid, isOwner) {
		return await api[isOwner ? 'del' : 'put'](`/groups/${groupslug}/ownership/${encodeURIComponent(uid)}`);
	};

	MemberList.kickMember = async function (groupslug, uid) {
		return await api.del(`/groups/${groupslug}/membership/${encodeURIComponent(uid)}`);
	};

	return MemberList;
});
