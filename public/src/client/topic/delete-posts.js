'use strict';

define('forum/topic/delete-posts', [
	'postSelect', 'alerts', 'api',
], function (postSelect, alerts, api) {
	const DeletePosts = {};
	let modal;
	let deleteBtn;
	let purgeBtn;
	let tid;

	DeletePosts.init = function () {
		tid = ajaxify.data.tid;

		$(window).off('action:ajaxify.end', onAjaxifyEnd).on('action:ajaxify.end', onAjaxifyEnd);

		if (modal) {
			return;
		}

		app.parseAndTranslate('partials/delete_posts_modal', {}, function (html) {
			modal = html;

			$('body').append(modal);

			deleteBtn = modal.find('#delete_posts_confirm');
			purgeBtn = modal.find('#purge_posts_confirm');

			modal.find('.close,#delete_posts_cancel').on('click', closeModal);

			postSelect.init(function () {
				checkButtonEnable();
				showPostsSelected();
			});
			showPostsSelected();

			deleteBtn.on('click', function () {
				deletePosts(deleteBtn, pid => `/posts/${pid}/state`);
			});
			purgeBtn.on('click', function () {
				deletePosts(purgeBtn, pid => `/posts/${pid}`);
			});
		});
	};

	function onAjaxifyEnd() {
		if (ajaxify.data.template.name !== 'topic' || ajaxify.data.tid !== tid) {
			closeModal();
			$(window).off('action:ajaxify.end', onAjaxifyEnd);
		}
	}

	function deletePosts(btn, route) {
		btn.attr('disabled', true);
		Promise.all(postSelect.pids.map(pid => api.delete(route(pid), {})))
			.then(closeModal)
			.catch(alerts.error)
			.finally(() => {
				btn.removeAttr('disabled');
			});
	}

	function showPostsSelected() {
		if (postSelect.pids.length) {
			modal.find('#pids').translateHtml('[[topic:fork_pid_count, ' + postSelect.pids.length + ']]');
		} else {
			modal.find('#pids').translateHtml('[[topic:fork_no_pids]]');
		}
	}

	function checkButtonEnable() {
		if (postSelect.pids.length) {
			deleteBtn.removeAttr('disabled');
			purgeBtn.removeAttr('disabled');
		} else {
			deleteBtn.attr('disabled', true);
			purgeBtn.attr('disabled', true);
		}
	}

	function closeModal() {
		if (modal) {
			modal.remove();
			modal = null;
			postSelect.disable();
		}
	}

	return DeletePosts;
});
