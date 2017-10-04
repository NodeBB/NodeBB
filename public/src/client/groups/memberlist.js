'use strict';


define('forum/groups/memberlist', ['components', 'forum/infinitescroll'], function () {
	var MemberList = {};
	var searchInterval;
	var groupName;
	var templateName;

	MemberList.init = function (_templateName) {
		templateName = _templateName || 'groups/details';
		groupName = ajaxify.data.group.name;

		handleMemberSearch();
		handleMemberInfiniteScroll();
	};

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
