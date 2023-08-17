'use strict';


define('forum/topic/votes', [
	'components', 'translator', 'api', 'hooks', 'bootbox', 'alerts', 'bootstrap',
], function (components, translator, api, hooks, bootbox, alerts, bootstrap) {
	const Votes = {};
	let _showTooltip = {};

	Votes.addVoteHandler = function () {
		_showTooltip = {};
		components.get('topic').on('mouseenter', '[data-pid] [component="post/vote-count"]', loadDataAndCreateTooltip);
		components.get('topic').on('mouseleave', '[data-pid] [component="post/vote-count"]', destroyTooltip);
	};

	function destroyTooltip() {
		const $this = $(this);
		const pid = $this.parents('[data-pid]').attr('data-pid');
		const tooltip = bootstrap.Tooltip.getInstance(this);
		if (tooltip) {
			tooltip.dispose();
			$this.attr('title', '');
		}
		_showTooltip[pid] = false;
	}

	function loadDataAndCreateTooltip() {
		const $this = $(this);
		const el = $this.parent();
		const pid = el.parents('[data-pid]').attr('data-pid');
		_showTooltip[pid] = true;
		const tooltip = bootstrap.Tooltip.getInstance(this);
		if (tooltip) {
			tooltip.dispose();
			$this.attr('title', '');
		}

		socket.emit('posts.getUpvoters', [pid], function (err, data) {
			if (err) {
				return alerts.error(err);
			}
			if (_showTooltip[pid] && data.length) {
				createTooltip($this, data[0]);
			}
		});
	}

	function createTooltip(el, data) {
		function doCreateTooltip(title) {
			el.attr('title', title);
			(new bootstrap.Tooltip(el, {
				container: '#content',
				html: true,
			})).show();
		}
		let usernames = data.usernames
			.filter(name => name !== '[[global:former_user]]');
		if (!usernames.length) {
			return;
		}
		if (usernames.length + data.otherCount > data.cutoff) {
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
				if (!app.user.uid) {
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

			app.parseAndTranslate('modals/votes', data, function (html) {
				const dialog = bootbox.dialog({
					title: '[[global:voters]]',
					message: html,
					className: 'vote-modal',
					show: true,
					onEscape: true,
					backdrop: true,
				});

				dialog.on('click', function () {
					dialog.modal('hide');
				});
			});
		});
	};


	return Votes;
});
