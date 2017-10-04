'use strict';


define('flags', ['benchpress'], function (Benchpress) {
	var Flag = {};
	var flagModal;
	var flagCommit;

	Flag.showFlagModal = function (data) {
		parseModal(data, function (html) {
			flagModal = $(html);

			flagModal.on('hidden.bs.modal', function () {
				flagModal.remove();
			});

			flagCommit = flagModal.find('#flag-post-commit');

			flagModal.on('click', '.flag-reason', function () {
				createFlag(data.type, data.id, $(this).text());
			});

			flagCommit.on('click', function () {
				createFlag(data.type, data.id, flagModal.find('#flag-reason-custom').val());
			});

			flagModal.modal('show');

			flagModal.find('#flag-reason-custom').on('keyup blur change', checkFlagButtonEnable);
		});
	};

	function parseModal(tplData, callback) {
		Benchpress.parse('partials/modals/flag_modal', tplData, function (html) {
			require(['translator'], function (translator) {
				translator.translate(html, callback);
			});
		});
	}

	function createFlag(type, id, reason) {
		if (!type || !id || !reason) {
			return;
		}
		socket.emit('flags.create', { type: type, id: id, reason: reason }, function (err) {
			if (err) {
				return app.alertError(err.message);
			}

			flagModal.modal('hide');
			app.alertSuccess('[[flags:modal-submit-success]]');
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
