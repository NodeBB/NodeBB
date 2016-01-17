'use strict';

/* globals define, app, ajaxify, socket, templates, translator */

define('forum/topic/fork', ['components', 'postSelect'], function(components, postSelect) {

	var Fork = {},
		forkModal,
		forkCommit;

	Fork.init = function() {
		$('.topic').on('click', '[component="topic/fork"]', onForkThreadClicked);
	};

	function onForkThreadClicked() {
		parseModal(function(html) {
			forkModal = $(html);

			forkModal.on('hidden.bs.modal', function() {
				forkModal.remove();
			});

			forkCommit = forkModal.find('#fork_thread_commit');

			showForkModal();

			forkModal.find('.close,#fork_thread_cancel').on('click', closeForkModal);
			forkModal.find('#fork-title').on('change', checkForkButtonEnable);

			postSelect.init(function() {
				checkForkButtonEnable();
				showPostsSelected();
			});
			showPostsSelected();

			forkCommit.on('click', createTopicFromPosts);
		});
	}

	function parseModal(callback) {
		templates.parse('partials/fork_thread_modal', {}, function(html) {
			translator.translate(html, callback);
		});
	}

	function showForkModal() {
		forkModal.modal({backdrop: false, show: true})
			.css('position', 'fixed')
			.css('left', Math.max(0, (($(window).width() - forkModal.outerWidth()) / 2) + $(window).scrollLeft()) + 'px')
			.css('top', '0px')
			.css('z-index', '2000');
	}

	function createTopicFromPosts() {
		forkCommit.attr('disabled', true);
		socket.emit('topics.createTopicFromPosts', {
			title: forkModal.find('#fork-title').val(),
			pids: postSelect.pids
		}, function(err, newTopic) {
			function fadeOutAndRemove(pid) {
				components.get('post', 'pid', pid).fadeOut(500, function() {
					$(this).remove();
				});
			}
			forkCommit.removeAttr('disabled');
			if (err) {
				return app.alertError(err.message);
			}

			app.alert({
				timeout: 5000,
				title: '[[global:alert.success]]',
				message: '[[topic:fork_success]]',
				type: 'success',
				clickfn: function() {
					ajaxify.go('topic/' + newTopic.slug);
				}
			});

			postSelect.pids.forEach(function(pid) {
				fadeOutAndRemove(pid);
			});

			closeForkModal();
		});
	}

	function showPostsSelected() {
		if (postSelect.pids.length) {
			forkModal.find('#fork-pids').text(postSelect.pids.join(', '));
		} else {
			forkModal.find('#fork-pids').translateHtml('[[topic:fork_no_pids]]');
		}
	}

	function checkForkButtonEnable() {
		if (forkModal.find('#fork-title').length && postSelect.pids.length) {
			forkCommit.removeAttr('disabled');
		} else {
			forkCommit.attr('disabled', true);
		}
	}

	function closeForkModal() {
		postSelect.pids.forEach(function(pid) {
			components.get('post', 'pid', pid).css('opacity', 1);
		});

		forkModal.modal('hide');

		components.get('topic').off('click', '[data-pid]');
		postSelect.enableClicksOnPosts();
	}

	return Fork;
});
