'use strict';


define('forum/account/info', ['forum/account/header', 'alerts', 'forum/account/sessions'], function (header, alerts, sessions) {
	const Info = {};

	Info.init = function () {
		header.init();
		handleModerationNote();
		sessions.prepareSessionRevocation();
	};

	function handleModerationNote() {
		$('[component="account/save-moderation-note"]').on('click', function () {
			const noteEl = $('[component="account/moderation-note"]');
			const note = noteEl.val();
			socket.emit('user.setModerationNote', {
				uid: ajaxify.data.uid,
				note: note,
			}, function (err, notes) {
				if (err) {
					return alerts.error(err);
				}
				noteEl.val('');

				app.parseAndTranslate('account/info', 'moderationNotes', { moderationNotes: notes }, function (html) {
					$('[component="account/moderation-note/list"]').prepend(html);
					html.find('.timeago').timeago();
				});
			});
		});


		$('[component="account/moderation-note/edit"]').on('click', function () {
			const parent = $(this).parents('[data-id]');
			const contentArea = parent.find('[component="account/moderation-note/content-area"]');
			const editArea = parent.find('[component="account/moderation-note/edit-area"]');
			contentArea.addClass('hidden');
			editArea.removeClass('hidden');
			editArea.find('textarea').trigger('focus').putCursorAtEnd();
		});

		$('[component="account/moderation-note/save-edit"]').on('click', function () {
			const parent = $(this).parents('[data-id]');
			const contentArea = parent.find('[component="account/moderation-note/content-area"]');
			const editArea = parent.find('[component="account/moderation-note/edit-area"]');
			contentArea.removeClass('hidden');
			const textarea = editArea.find('textarea');

			socket.emit('user.editModerationNote', {
				uid: ajaxify.data.uid,
				id: parent.attr('data-id'),
				note: textarea.val(),
			}, function (err, notes) {
				if (err) {
					return alerts.error(err);
				}
				textarea.css({
					height: textarea.prop('scrollHeight') + 'px',
				});
				editArea.addClass('hidden');
				contentArea.find('.content').html(notes[0].note);
			});
		});

		$('[component="account/moderation-note/cancel-edit"]').on('click', function () {
			const parent = $(this).parents('[data-id]');
			const contentArea = parent.find('[component="account/moderation-note/content-area"]');
			const editArea = parent.find('[component="account/moderation-note/edit-area"]');
			contentArea.removeClass('hidden');
			editArea.addClass('hidden');
		});

		$('[component="account/moderation-note/edit-area"] textarea').each((i, el) => {
			const $el = $(el);
			$el.css({
				height: $el.prop('scrollHeight') + 'px',
			}).parent().addClass('hidden');
		});
	}

	return Info;
});
