'use strict';


define('forum/topic/votes', [
	'components', 'translator', 'benchpress', 'api',
], function (components, translator, Benchpress, api) {
	var Votes = {};

	Votes.addVoteHandler = function () {
		components.get('topic').on('mouseenter', '[data-pid] [component="post/vote-count"]', loadDataAndCreateTooltip);
	};

	function loadDataAndCreateTooltip(e) {
		e.stopPropagation();

		var $this = $(this);
		var el = $this.parent();
		var pid = el.parents('[data-pid]').attr('data-pid');

		socket.emit('posts.getUpvoters', [pid], function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			if (data.length) {
				createTooltip($this, data[0]);
			}
		});
		return false;
	}

	function createTooltip(el, data) {
		function doCreateTooltip(title) {
			el.attr('title', title).tooltip('fixTitle').tooltip('show');
		}
		var usernames = data.usernames
			.filter(name => name !== '[[global:former_user]]');
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


	Votes.toggleVote = function (button, className, delta) {
		var post = button.closest('[data-pid]');
		var currentState = post.find(className).length;

		const method = currentState ? 'del' : 'put';
		api[method](`/posts/${post.attr('data-pid')}/vote`, {
			delta: delta,
		}).catch((err) => {
			app.alertError(err.message);

			if (err.message === '[[error:not-logged-in]]') {
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
						title: '[[global:voters]]',
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
