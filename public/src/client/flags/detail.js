'use strict';

/* globals define */

define('forum/flags/detail', ['components'], function (components) {
	var Flags = {};

	Flags.init = function () {
		// Update attributes
		$('#state').val(ajaxify.data.state).removeAttr('disabled');
		$('#assignee').val(ajaxify.data.assignee).removeAttr('disabled');

		$('[data-action]').on('click', function () {
			var action = this.getAttribute('data-action');

			switch (action) {
				case 'update':
					socket.emit('flags.update', {
						flagId: ajaxify.data.flagId,
						data: $('#attributes').serializeArray()
					}, function (err) {
						if (err) {
							return app.alertError(err.message);
						} else {
							app.alertSuccess('[[flags:updated]]');
						}
					});
					break;
				
				case 'appendNote':
					socket.emit('flags.appendNote', {
						flagId: ajaxify.data.flagId,
						note: document.getElementById('note').value
					}, function (err, notes) {
						if (err) {
							return app.alertError(err.message);
						} else {
							app.alertSuccess('[[flags:note-added]]');
							Flags.reloadNotes(notes);
						}
					});
					break;
			}
		});
	};

	Flags.reloadNotes = function (notes) {
		templates.parse('flags/detail', 'notes', {
			notes: notes
		}, function (html) {
			var wrapperEl = components.get('flag/notes');
			wrapperEl.empty();
			wrapperEl.html(html);
			wrapperEl.find('span.timeago').timeago();
			document.getElementById('note').value = '';
		});
	};

	return Flags;
});
