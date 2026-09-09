'use strict';


define('forum/topic/votes', [
	'components', 'translator', 'api', 'hooks', 'modals', 'alerts', 'bootstrap', 'benchpress',
], function (components, translator, api, hooks, modals, alerts, bootstrap, Benchpress) {
	const Votes = {};
	let _showTooltip = {};

	Votes.addVoteHandler = function () {
		_showTooltip = {};
		if (canSeeUpVotes()) {
			components.get('topic').on('mouseenter', '[data-pid] [component="post/vote-count"]', loadDataAndCreateTooltip);
			components.get('topic').on('mouseleave', '[data-pid] [component="post/vote-count"]', destroyTooltip);
		}

		components.get('topic').on('mouseenter', '[data-pid] [component="post/announce-count"]', loadDataAndCreateTooltip);
		components.get('topic').on('mouseleave', '[data-pid] [component="post/announce-count"]', destroyTooltip);
	};

	function canSeeUpVotes() {
		const { upvoteVisibility, privileges } = ajaxify.data;
		return privileges.isAdminOrMod ||
			upvoteVisibility === 'all' ||
			(upvoteVisibility === 'loggedin' && config.loggedIn);
	}

	function canSeeVotes() {
		const { upvoteVisibility, downvoteVisibility, privileges } = ajaxify.data;
		return privileges.isAdminOrMod ||
			upvoteVisibility === 'all' || downvoteVisibility === 'all' ||
			((upvoteVisibility === 'loggedin' || downvoteVisibility === 'loggedin') && config.loggedIn);
	}

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
		const path = $this.attr('component') === 'post/vote-count' ?
			`/posts/${encodeURIComponent(pid)}/upvoters` :
			`/posts/${encodeURIComponent(pid)}/announcers/tooltip`;

		api.get(path, {}, function (err, data) {
			if (err) {
				return alerts.error(err);
			}
			if (_showTooltip[pid] && data) {
				createTooltip($this, data);
			}
		});
	}

	async function createTooltip(el, data) {
		function doCreateTooltip(title) {
			el.attr('title', title);
			(new bootstrap.Tooltip(el, {
				container: '#content',
				html: true,
			})).show();
		}
		const usernames = data.usernames
			.filter(name => name !== '[[global:former-user]]');
		if (!usernames.length) {
			return;
		}
		const usersList = usernames.join(', ');
		if (usernames.length + data.otherCount > data.cutoff) {
			const translated = await translator.translateKey('topic:users-and-others', [usersList, data.otherCount]);
			doCreateTooltip(translated);
		} else {
			doCreateTooltip(utils.escapeHTML(usersList));
		}
	}


	Votes.toggleVote = async function (button, className, delta, iconSelector) {
		const post = button.closest('[data-pid]');

		// Determine current state from the button element itself (works for both
		// topic page with component="post/upvote" and world feed with data-action="upvote")
		const classToCheck = className.replace(/^\./, '');
		const currentState = button.hasClass(classToCheck);
		const method = currentState ? 'del' : 'put';
		const voteDelta = currentState ? -delta : delta;
		const pid = post.attr('data-pid');

		if (!app.user.uid) {
			if (!config.activitypub.enabled) {
				ajaxify.go('login');
				return false;
			}

			let objectId;
			if (utils.isNumber(pid)) {
				objectId = config.url + '/post/' + pid;
			} else {
				objectId = pid;
			}
			import('modules/intents').then(({ trigger }) => {
				trigger('like', { object: objectId });
			});
			return false;
		}

		// Optimistic UI update — instant feedback
		button.toggleClass(classToCheck);

		// Toggle icon state (optional — callers pass a selector for the icon element)
		if (iconSelector) {
			const icon = button.find(iconSelector);
			icon.toggleClass('fa text-danger', !currentState)
				.toggleClass('fa-regular text-muted', currentState);
		}

		// Topic page uses [component="post/vote-count"], world feed uses [component="upvote-count"]
		const voteCountEl = post.find('[component="post/vote-count"], [component="upvote-count"]');
		if (voteCountEl.length) {
			const currentVotes = parseInt(voteCountEl.attr('data-votes') || voteCountEl.text(), 10) || 0;
			voteCountEl.text(currentVotes + voteDelta).attr('data-votes', currentVotes + voteDelta);
		}

		// API call in background
		try {
			await api[method](`/posts/${encodeURIComponent(pid)}/vote`, {
				delta: voteDelta,
			});
		} catch (e) {
			// Rollback on failure — revert button + counter + icon
			button.toggleClass(classToCheck);

			if (iconSelector) {
				const icon = button.find(iconSelector);
				icon.toggleClass('fa text-danger', !currentState)
					.toggleClass('fa-regular text-muted', currentState);
			}

			if (voteCountEl.length) {
				const rollbackVotes = parseInt(voteCountEl.attr('data-votes') || voteCountEl.text(), 10) || 0;
				voteCountEl.text(rollbackVotes - voteDelta).attr('data-votes', rollbackVotes - voteDelta);
			}

			alerts.error(e.message);
			return false;
		}

		hooks.fire('action:post.toggleVote', {
			pid: pid,
			delta: voteDelta,
			unvote: method === 'del',
		});

		return false;
	};

	Votes.showVotes = async function (pid) {
		if (!canSeeVotes()) {
			return;
		}
		const data = await api.get(`/posts/${encodeURIComponent(pid)}/voters`, {});
		const html = await Benchpress.render('modals/votes', data);
		const dialog = await modals.dialog({
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
	};

	Votes.showAnnouncers = async function (pid) {
		const data = await api.get(`/posts/${encodeURIComponent(pid)}/announcers`, {})
			.catch(err => alerts.error(err));

		const html = await app.parseAndTranslate('modals/announcers', data);
		const dialog = await modals.dialog({
			title: `[[topic:announcers-x, ${data.announceCount}]]`,
			message: html,
			className: 'announce-modal',
			show: true,
			onEscape: true,
			backdrop: true,
		});

		dialog.on('click', function () {
			dialog.modal('hide');
		});
	};

	return Votes;
});
