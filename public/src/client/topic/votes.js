'use strict';


define('forum/topic/votes', ['components', 'translator', 'benchpress'], function (components, translator, Benchpress) {
	var Votes = {};

	Votes.addVoteHandler = function () {
		components.get('topic').on('mouseenter', '[data-pid] [component="post/vote-count"]', loadDataAndCreateTooltip);
		components.get('topic').on('mouseout', '[data-pid] [component="post/vote-count"]', function () {
			var el = $(this).parent();
			el.on('shown.bs.tooltip', function () {
				$('.tooltip').tooltip('destroy');
				el.off('shown.bs.tooltip');
			});

			$('.tooltip').tooltip('destroy');
		});
	};

	function loadDataAndCreateTooltip(e) {
		e.stopPropagation();

		var $this = $(this);
		var el = $this.parent();
		var pid = el.parents('[data-pid]').attr('data-pid');

		$('.tooltip').tooltip('destroy');
		$this.off('mouseenter', loadDataAndCreateTooltip);

		socket.emit('posts.getUpvoters', [pid], function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			if (data.length) {
				createTooltip(el, data[0]);
			}
			$this.off('mouseenter').on('mouseenter', loadDataAndCreateTooltip);
		});
		return false;
	}

	function createTooltip(el, data) {
		function doCreateTooltip(title) {
			el.attr('title', title).tooltip('fixTitle').tooltip('show');
		}
		var usernames = data.usernames;
		if (!usernames.length) {
			return;
		}
		if (usernames.length + data.otherCount > 6) {
			usernames = usernames.join(', ').replace(/,/g, '|');
			translator.translate('[[topic:users_and_others, ' + usernames + ', ' + data.otherCount + ']]', function (translated) {
				translated = translated.replace(/\|/g, ',');
				doCreateTooltip(translated);
			});
		} else {
			usernames = usernames.join(', ');
			doCreateTooltip(usernames);
		}
	}


	Votes.toggleVote = function (button, className, method) {
		var post = button.closest('[data-pid]');
		var currentState = post.find(className).length;

		socket.emit(currentState ? 'posts.unvote' : method, {
			pid: post.attr('data-pid'),
			room_id: 'topic_' + ajaxify.data.tid,
		}, function (err) {
			if (err) {
				app.alertError(err.message);
			}

			if (err && err.message === '[[error:not-logged-in]]') {
				ajaxify.go('login');
			}
		});

		return false;
	};

	Votes.showVotes = function (pid) {
		socket.emit('posts.getVoters', { pid: pid, cid: ajaxify.data.cid }, function (err, data) {
			if (err) {
				if (err.message === '[[error:no-privileges]]') {
					return;
				}

				// Only show error if it's an unexpected error.
				return app.alertError(err.message);
			}

			Benchpress.parse('partials/modals/votes_modal', data, function (html) {
				translator.translate(html, function (translated) {
					var dialog = bootbox.dialog({
						title: 'Voters',
						message: translated,
						className: 'vote-modal',
						show: true,
					});

					dialog.on('click', function () {
						dialog.modal('hide');
					});
				});
			});
		});
	};


	return Votes;
});
