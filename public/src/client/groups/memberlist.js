'use strict';

define('forum/groups/memberlist', ['api'], function (api) {
	var MemberList = {};
	var searchInterval;
	var groupName;
	var templateName;

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
				var foundUsers = [];
				var modal = bootbox.dialog({
					title: '[[groups:details.add-member]]',
					message: html,
					buttons: {
						ok: {
							callback: function () {
								var users = [];
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
					var isSelected = $(this).attr('data-selected') === '1';
					if (isSelected) {
						$(this).removeAttr('data-selected');
					} else {
						$(this).attr('data-selected', 1);
					}
					$(this).find('i').toggleClass('invisible');
				});
				modal.find('input').on('keyup', function () {
					socket.emit('user.search', {
						query: $(this).val(),
						paginate: false,
					}, function (err, result) {
						if (err) {
							return app.alertError(err.message);
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
		var uids = users.map(function (user) { return user.uid; });
		if (groupName === 'administrators') {
			socket.emit('admin.user.makeAdmins', uids, function (err) {
				if (err) {
					return app.alertError(err);
				}
				done();
			});
		} else {
			Promise.all(uids.map(uid => api.put('/groups/' + ajaxify.data.group.slug + '/membership/' + uid))).then(done);
		}
	}

	function handleMemberSearch() {
		$('[component="groups/members/search"]').on('keyup', function () {
			var query = $(this).val();
			if (searchInterval) {
				clearInterval(searchInterval);
				searchInterval = 0;
			}

			searchInterval = setTimeout(function () {
				socket.emit('groups.searchMembers', { groupName: groupName, query: query }, function (err, results) {
					if (err) {
						return app.alertError(err.message);
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
			var $this = $(this);
			var bottom = ($this[0].scrollHeight - $this.innerHeight()) * 0.9;

			if ($this.scrollTop() > bottom && !$('[component="groups/members/search"]').val()) {
				loadMoreMembers();
			}
		});
	}

	function loadMoreMembers() {
		var members = $('[component="groups/members"]');
		if (members.attr('loading')) {
			return;
		}

		members.attr('loading', 1);
		socket.emit('groups.loadMoreMembers', {
			groupName: groupName,
			after: members.attr('data-nextstart'),
		}, function (err, data) {
			if (err) {
				return app.alertError(err.message);
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
