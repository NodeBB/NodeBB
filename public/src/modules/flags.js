'use strict';


define('flags', ['hooks', 'components', 'api'], function (hooks, components, api) {
	var Flag = {};
	var flagModal;
	var flagCommit;
	var flagReason;

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
				var selected = $('input[name="flag-reason"]:checked');
				var reason = selected.val();
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
			app.alertSuccess('[[flags:resolved]]');
			hooks.fire('action:flag.resolved', { flagId: flagId });
		}).catch(app.alertError);
	};

	function createFlag(type, id, reason) {
		if (!type || !id || !reason) {
			return;
		}
		var data = { type: type, id: id, reason: reason };
		api.post('/flags', data, function (err, flagId) {
			if (err) {
				return app.alertError(err.message);
			}

			flagModal.modal('hide');
			app.alertSuccess('[[flags:modal-submit-success]]');
			if (type === 'post') {
				var postEl = components.get('post', 'pid', id);
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
