'use strict';


define('forum/topic/votes', [
	'components', 'translator', 'api', 'hooks', 'bootbox', 'alerts',
], function (components, translator, api, hooks, bootbox, alerts) {
	const Votes = {};

	Votes.addVoteHandler = function () {
		components.get('topic').on('mouseenter', '[data-pid] [component="post/vote-count"]', loadDataAndCreateTooltip);
	};

	function loadDataAndCreateTooltip(e) {
		e.stopPropagation();

		const $this = $(this);
		const el = $this.parent();
		el.find('.tooltip').css('display', 'none');
		const pid = el.parents('[data-pid]').attr('data-pid');

		socket.emit('posts.getUpvoters', [pid], function (err, data) {
			if (err) {
				return alerts.error(err);
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
			el.parent().find('.tooltip').css('display', '');
		}
		let usernames = data.usernames
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
		const post = button.closest('[data-pid]');
		const currentState = post.find(className).length;

		const method = currentState ? 'del' : 'put';
		const pid = post.attr('data-pid');
		api[method](`/posts/${pid}/vote`, {
			delta: delta,
		}, function (err) {
			if (err) {
				// TODO: err.message is currently hardcoded in helpers/api.js
				if (err.message === 'A valid login session was not found. Please log in and try again.') {
					ajaxify.go('login');
					return;
				}
				return alerts.error(err);
			}
			hooks.fire('action:post.toggleVote', {
				pid: pid,
				delta: delta,
				unvote: method === 'del',
			});
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
				return alerts.error(err);
			}

			app.parseAndTranslate('partials/modals/votes_modal', data, function (html) {
				const dialog = bootbox.dialog({
					title: '[[global:voters]]',
					message: html,
					className: 'vote-modal',
					show: true,
				});

				dialog.on('click', function () {
					dialog.modal('hide');
				});
			});
		});
	};


	return Votes;
});
