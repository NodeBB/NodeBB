'use strict';


define('flags', ['hooks', 'components', 'api', 'alerts'], function (hooks, components, api, alerts) {
	const Flag = {};
	let flagModal;
	let flagCommit;
	let flagReason;

	Flag.showFlagModal = function (data) {
		app.parseAndTranslate('partials/modals/flag_modal', data, function (html) {
			flagModal = html;
			flagModal.on('hidden.bs.modal', function () {
				flagModal.remove();
			});

			flagCommit = flagModal.find('#flag-post-commit');
			flagReason = flagModal.find('#flag-reason-custom');

			flagModal.on('click', 'input[name="flag-reason"]', function () {
				if ($(this).attr('id') === 'flag-reason-other') {
					flagReason.removeAttr('disabled');
					if (!flagReason.val().length) {
						flagCommit.attr('disabled', true);
					}
				} else {
					flagReason.attr('disabled', true);
					flagCommit.removeAttr('disabled');
				}
			});

			flagCommit.on('click', function () {
				const selected = $('input[name="flag-reason"]:checked');
				let reason = selected.val();
				if (selected.attr('id') === 'flag-reason-other') {
					reason = flagReason.val();
				}
				createFlag(data.type, data.id, reason);
			});

			flagModal.on('click', '#flag-reason-other', function () {
				flagReason.focus();
			});

			flagModal.modal('show');
			hooks.fire('action:flag.showModal', {
				modalEl: flagModal,
				type: data.type,
				id: data.id,
			});

			flagModal.find('#flag-reason-custom').on('keyup blur change', checkFlagButtonEnable);
		});
	};

	Flag.resolve = function (flagId) {
		api.put(`/flags/${flagId}`, {
			state: 'resolved',
		}).then(() => {
			alerts.success('[[flags:resolved]]');
			hooks.fire('action:flag.resolved', { flagId: flagId });
		}).catch(alerts.error);
	};

	function createFlag(type, id, reason) {
		if (!type || !id || !reason) {
			return;
		}
		const data = { type: type, id: id, reason: reason };
		api.post('/flags', data, function (err, flagId) {
			if (err) {
				return alerts.error(err);
			}

			flagModal.modal('hide');
			alerts.success('[[flags:modal-submit-success]]');
			if (type === 'post') {
				const postEl = components.get('post', 'pid', id);
				postEl.find('[component="post/flag"]').addClass('hidden').parent().attr('hidden', '');
				postEl.find('[component="post/already-flagged"]').removeClass('hidden').parent().attr('hidden', null);
			}
			hooks.fire('action:flag.create', { flagId: flagId, data: data });
		});
	}

	function checkFlagButtonEnable() {
		if (flagModal.find('#flag-reason-custom').val()) {
			flagCommit.removeAttr('disabled');
		} else {
			flagCommit.attr('disabled', true);
		}
	}

	return Flag;
});
