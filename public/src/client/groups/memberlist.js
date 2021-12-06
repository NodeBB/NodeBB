'use strict';

define('forum/groups/memberlist', ['api', 'bootbox', 'alerts'], function (api, bootbox, alerts) {
	const MemberList = {};
	let searchInterval;
	let groupName;
	let templateName;

	MemberList.init = function (_templateName) {
		templateName = _templateName || 'groups/details';
		groupName = ajaxify.data.group.name;

		handleMemberAdd();
		handleMemberSearch();
		handleMemberInfiniteScroll();
	};

	function handleMemberAdd() {
		$('[component="groups/members/add"]').on('click', function () {
			app.parseAndTranslate('admin/partials/groups/add-members', {}, function (html) {
				const foundUsers = [];
				const modal = bootbox.dialog({
					title: '[[groups:details.add-member]]',
					message: html,
					buttons: {
						ok: {
							callback: function () {
								const users = [];
								modal.find('[data-uid][data-selected]').each(function (index, el) {
									users.push(foundUsers[$(el).attr('data-uid')]);
								});
								addUserToGroup(users, function () {
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

	function addUserToGroup(users, callback) {
		function done() {
			users = users.filter(function (user) {
				return !$('[component="groups/members"] [data-uid="' + user.uid + '"]').length;
			});
			parseAndTranslate(users, function (html) {
				$('[component="groups/members"] tbody').prepend(html);
			});
			callback();
		}
		const uids = users.map(function (user) { return user.uid; });
		if (groupName === 'administrators') {
			socket.emit('admin.user.makeAdmins', uids, function (err) {
				if (err) {
					return alerts.error(err);
				}
				done();
			});
		} else {
			Promise.all(uids.map(uid => api.put('/groups/' + ajaxify.data.group.slug + '/membership/' + uid))).then(done).catch(alerts.error);
		}
	}

	function handleMemberSearch() {
		$('[component="groups/members/search"]').on('keyup', function () {
			const query = $(this).val();
			if (searchInterval) {
				clearInterval(searchInterval);
				searchInterval = 0;
			}

			searchInterval = setTimeout(function () {
				socket.emit('groups.searchMembers', { groupName: groupName, query: query }, function (err, results) {
					if (err) {
						return alerts.error(err);
					}
					parseAndTranslate(results.users, function (html) {
						$('[component="groups/members"] tbody').html(html);
						$('[component="groups/members"]').attr('data-nextstart', 20);
					});
				});
			}, 250);
		});
	}

	function handleMemberInfiniteScroll() {
		$('[component="groups/members"] tbody').on('scroll', function () {
			const $this = $(this);
			const bottom = ($this[0].scrollHeight - $this.innerHeight()) * 0.9;

			if ($this.scrollTop() > bottom && !$('[component="groups/members/search"]').val()) {
				loadMoreMembers();
			}
		});
	}

	function loadMoreMembers() {
		const members = $('[component="groups/members"]');
		if (members.attr('loading')) {
			return;
		}

		members.attr('loading', 1);
		socket.emit('groups.loadMoreMembers', {
			groupName: groupName,
			after: members.attr('data-nextstart'),
		}, function (err, data) {
			if (err) {
				return alerts.error(err);
			}

			if (data && data.users.length) {
				onMembersLoaded(data.users, function () {
					members.removeAttr('loading');
					members.attr('data-nextstart', data.nextStart);
				});
			} else {
				members.removeAttr('loading');
			}
		});
	}

	function onMembersLoaded(users, callback) {
		users = users.filter(function (user) {
			return !$('[component="groups/members"] [data-uid="' + user.uid + '"]').length;
		});

		parseAndTranslate(users, function (html) {
			$('[component="groups/members"] tbody').append(html);
			callback();
		});
	}

	function parseAndTranslate(users, callback) {
		app.parseAndTranslate(templateName, 'group.members', {
			group: {
				members: users,
				isOwner: ajaxify.data.group.isOwner,
			},
		}, callback);
	}

	return MemberList;
});
