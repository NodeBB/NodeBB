'use strict';

/* globals define, socket, app, config, ajaxify, utils, translator, templates, bootbox */

var dependencies = [
	'taskbar',
	'composer/controls',
	'composer/uploads',
	'composer/formatting',
	'composer/drafts',
	'composer/tags',
	'composer/categoryList',
	'composer/preview',
	'composer/resize'
];

define('composer', dependencies, function(taskbar, controls, uploads, formatting, drafts, tags, categoryList, preview, resize) {
	var composer = {
		active: undefined,
		posts: {},
		bsEnvironment: undefined
	};

	socket.on('event:composer.ping', function(post_uuid) {
		if (composer.active === post_uuid) {
			socket.emit('modules.composer.pingActive', post_uuid);
		}
	});

	$(window).off('resize', onWindowResize).on('resize', onWindowResize);

	function onWindowResize() {
		if (composer.active !== undefined) {
			resize.reposition($('#cmp-uuid-' + composer.active));
		}
	}

	function alreadyOpen(post) {
		// If a composer for the same cid/tid/pid is already open, return the uuid, else return bool false
		var	type, id;

		if (post.hasOwnProperty('cid')) {
			type = 'cid';
		} else if (post.hasOwnProperty('tid')) {
			type = 'tid';
		} else if (post.hasOwnProperty('pid')) {
			type = 'pid';
		}

		id = post[type];

		// Find a match
		for(var uuid in composer.posts) {
			if (composer.posts[uuid].hasOwnProperty(type) && id === composer.posts[uuid][type]) {
				return uuid;
			}
		}

		// No matches...
		return false;
	}

	function push(post) {
		var uuid = utils.generateUUID(),
			existingUUID = alreadyOpen(post);

		if (existingUUID) {
			taskbar.updateActive(existingUUID);
			return composer.load(existingUUID);
		}

		translator.translate('[[topic:composer.new_topic]]', function(newTopicStr) {
			taskbar.push('composer', uuid, {
				title: post.title ? post.title : newTopicStr
			});
		});

		// Construct a save_id
		if (0 !== parseInt(app.uid, 10)) {
			if (post.hasOwnProperty('cid')) {
				post.save_id = ['composer', app.uid, 'cid', post.cid].join(':');
			} else if (post.hasOwnProperty('tid')) {
				post.save_id = ['composer', app.uid, 'tid', post.tid].join(':');
			} else if (post.hasOwnProperty('pid')) {
				post.save_id = ['composer', app.uid, 'pid', post.pid].join(':');
			}
		}

		composer.posts[uuid] = post;

		composer.load(uuid);
	}

	function composerAlert(message) {
		$('.action-bar button').removeAttr('disabled');
		app.alert({
			type: 'danger',
			timeout: 3000,
			title: '',
			message: message,
			alert_id: 'post_error'
		});
	}

	composer.addButton = function(iconClass, onClick) {
		formatting.addButton(iconClass, onClick);
	};

	composer.newTopic = function(cid) {
		push({
			cid: cid,
			title: '',
			body: '',
			modified: false,
			isMain: true
		});
	};

	composer.addQuote = function(tid, topicSlug, postIndex, pid, title, username, text) {
		var uuid = composer.active;

		if (uuid === undefined) {
			composer.newReply(tid, pid, title, '[[modules:composer.user_said, ' + username + ']]\n' + text);
			return;
		}
		var postContainer = $('#cmp-uuid-' + uuid);
		var bodyEl = postContainer.find('textarea');
		var prevText = bodyEl.val();
		if (parseInt(tid, 10) !== parseInt(composer.posts[uuid].tid, 10)) {
			var link = '[' + title + '](/topic/' + topicSlug + '/' + (parseInt(postIndex, 10) + 1) + ')';
			translator.translate('[[modules:composer.user_said_in, ' + username + ', ' + link + ']]\n', config.defaultLang, onTranslated);
		} else {
			translator.translate('[[modules:composer.user_said, ' + username + ']]\n', config.defaultLang, onTranslated);
		}

		function onTranslated(translated) {
			composer.posts[uuid].body = (prevText.length ? prevText + '\n\n' : '') + translated + text;
			bodyEl.val(composer.posts[uuid].body);
			focusElements(postContainer);
			preview.render(postContainer);
		}
	};

	composer.newReply = function(tid, pid, title, text) {
		translator.translate(text, config.defaultLang, function(translated) {
			push({
				tid: tid,
				toPid: pid,
				title: title,
				body: translated,
				modified: false,
				isMain: false
			});
		});
	};

	composer.editPost = function(pid) {
		socket.emit('modules.composer.push', pid, function(err, threadData) {
			if(err) {
				return app.alertError(err.message);
			}

			push({
				pid: pid,
				title: $('<div/>').html(threadData.title).text(),
				body: threadData.body,
				modified: false,
				isMain: threadData.isMain,
				topic_thumb: threadData.topic_thumb,
				tags: threadData.tags
			});
		});
	};

	composer.load = function(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid);
		if (postContainer.length) {
			activate(post_uuid);
			resize.reposition(postContainer);
			focusElements(postContainer);
		} else {
			createNewComposer(post_uuid);
		}

		var	postData = composer.posts[post_uuid];
		if (postData.tid) {
			socket.emit('modules.composer.register', {
				uuid: post_uuid,
				tid: postData.tid,
				uid: app.uid
			});
		}
	};

	function createNewComposer(post_uuid) {
		var allowTopicsThumbnail = config.allowTopicsThumbnail && composer.posts[post_uuid].isMain && (config.hasImageUploadPlugin || config.allowFileUploads);
		var isTopic = composer.posts[post_uuid] ? !!composer.posts[post_uuid].cid : false;
		var isMain = composer.posts[post_uuid] ? !!composer.posts[post_uuid].isMain : false;

		composer.bsEnvironment = utils.findBootstrapEnvironment();

		var template = (composer.bsEnvironment === 'xs' || composer.bsEnvironment === 'sm') ? 'composer-mobile' : 'composer';

		var data = {
			allowTopicsThumbnail: allowTopicsThumbnail,
			showTags: isTopic || isMain,
			isTopic: isTopic
		};

		parseAndTranslate(template, data, function(composerTemplate) {
			if ($('#cmp-uuid-' + post_uuid).length) {
				return;
			}
			composerTemplate = $(composerTemplate);

			composerTemplate.attr('id', 'cmp-uuid-' + post_uuid);

			$(document.body).append(composerTemplate);

			var postContainer = $(composerTemplate[0]),
				postData = composer.posts[post_uuid],
				bodyEl = postContainer.find('textarea'),
				draft = drafts.getDraft(postData.save_id);

			tags.init(postContainer, composer.posts[post_uuid]);
			categoryList.init(postContainer, composer.posts[post_uuid]);
			updateTitle(postData, postContainer);

			activate(post_uuid);
			resize.reposition(postContainer);

			if (config.allowFileUploads || config.hasImageUploadPlugin) {
				uploads.initialize(post_uuid);
			}

			formatting.addHandler(postContainer);

			if (allowTopicsThumbnail) {
				uploads.toggleThumbEls(postContainer, composer.posts[post_uuid].topic_thumb || '');
			}

			postContainer.on('change', 'input, textarea', function() {
				composer.posts[post_uuid].modified = true;
			});

			postContainer.on('click', '.action-bar button[data-action="post"]', function() {
				$(this).attr('disabled', true);
				post(post_uuid);
			});

			postContainer.on('click', '.action-bar button[data-action="discard"]', function() {
				if (!composer.posts[post_uuid].modified) {
					discard(post_uuid);
					return;
				}

				translator.translate('[[modules:composer.discard]]', function(translated) {
					bootbox.confirm(translated, function(confirm) {
						if (confirm) {
							discard(post_uuid);
						}
					});
				});
			});

			bodyEl.on('input propertychange', function() {
				preview.render(postContainer);
			});

			bodyEl.on('scroll', function() {
				preview.matchScroll(postContainer);
			});

			bodyEl.val(draft ? draft : postData.body);
			preview.render(postContainer, function() {
				preview.matchScroll(postContainer);
			});
			drafts.init(postContainer, postData);

			resize.handleResize(postContainer);

			handleHelp(postContainer);

			$(window).trigger('action:composer.loaded', {
				post_uuid: post_uuid
			});

			formatting.addComposerButtons();
			focusElements(postContainer);
		});
	}

	function parseAndTranslate(template, data, callback) {
		templates.parse(template, data, function(composerTemplate) {
			translator.translate(composerTemplate, callback);
		});
	}

	function handleHelp(postContainer) {
		var helpBtn = postContainer.find('.help');
		socket.emit('modules.composer.renderHelp', function(err, html) {
			if (!err && html && html.length > 0) {
				helpBtn.removeClass('hidden');
				helpBtn.on('click', function() {
					bootbox.alert(html);
				});
			}
		});
	}

	function updateTitle(postData, postContainer) {
		var titleEl = postContainer.find('.title');

		if (parseInt(postData.tid, 10) > 0) {
			titleEl.translateVal('[[topic:composer.replying_to, ' + postData.title + ']]');
			titleEl.prop('disabled', true);
		} else if (parseInt(postData.pid, 10) > 0) {
			titleEl.val(postData.title);
			titleEl.prop('disabled', true);
			socket.emit('modules.composer.editCheck', postData.pid, function(err, editCheck) {
				if (!err && editCheck.titleEditable) {
					titleEl.prop('disabled', false);
				}
			});

		} else {
			titleEl.val(postData.title);
			titleEl.prop('disabled', false);
		}
	}

	function activate(post_uuid) {
		if(composer.active && composer.active !== post_uuid) {
			composer.minimize(composer.active);
		}

		composer.active = post_uuid;
	}

	function focusElements(postContainer) {
		var title = postContainer.find('.title'),
			bodyEl = postContainer.find('textarea');

		if (title.is(':disabled')) {
			bodyEl.focus().putCursorAtEnd();
		} else {
			title.focus();
		}
	}

	function post(post_uuid) {
		var postData = composer.posts[post_uuid],
			postContainer = $('#cmp-uuid-' + post_uuid),
			titleEl = postContainer.find('.title'),
			bodyEl = postContainer.find('textarea'),
			thumbEl = postContainer.find('input#topic-thumb-url');

		titleEl.val(titleEl.val().trim());
		bodyEl.val(bodyEl.val().trim());
		if (thumbEl.length) {
			thumbEl.val(thumbEl.val().trim());
		}

		var checkTitle = parseInt(postData.cid, 10) || parseInt(postData.pid, 10);

		if (uploads.inProgress[post_uuid] && uploads.inProgress[post_uuid].length) {
			return composerAlert('[[error:still-uploading]]');
		} else if (checkTitle && titleEl.val().length < parseInt(config.minimumTitleLength, 10)) {
			return composerAlert('[[error:title-too-short, ' + config.minimumTitleLength + ']]');
		} else if (checkTitle && titleEl.val().length > parseInt(config.maximumTitleLength, 10)) {
			return composerAlert('[[error:title-too-long, ' + config.maximumTitleLength + ']]');
		} else if (checkTitle && !utils.slugify(titleEl.val()).length) {
			return composerAlert('[[error:invalid-title]]');
		} else if (bodyEl.val().length < parseInt(config.minimumPostLength, 10)) {
			return composerAlert('[[error:content-too-short, ' + config.minimumPostLength + ']]');
		}

		var composerData = {}, action;

		if (parseInt(postData.cid, 10) > 0) {
			composerData = {
				title: titleEl.val(),
				content: bodyEl.val(),
				topic_thumb: thumbEl.val() || '',
				category_id: postData.cid,
				tags: tags.getTags(post_uuid)
			};

			action = 'topics.post';
			socket.emit(action, composerData, function(err, topic) {
				done(err);

				if (!err) {
					ajaxify.go('topic/' + topic.slug);
				}
			});
		} else if (parseInt(postData.tid, 10) > 0) {
			composerData = {
				tid: postData.tid,
				content: bodyEl.val(),
				toPid: postData.toPid
			};

			action = 'posts.reply';
			socket.emit(action, composerData, done);
		} else if (parseInt(postData.pid, 10) > 0) {
			composerData = {
				pid: postData.pid,
				content: bodyEl.val(),
				title: titleEl.val(),
				topic_thumb: thumbEl.val() || '',
				tags: tags.getTags(post_uuid)
			};

			action = 'posts.edit';
			socket.emit(action, composerData, done);
		}

		function done(err) {
			$('.action-bar button').removeAttr('disabled');
			if (err) {
				if (err.message === '[[error:email-not-confirmed]]') {
					return showEmailConfirmAlert(err);
				}

				return app.alertError(err.message);
			}

			discard(post_uuid);
			drafts.removeDraft(postData.save_id);

			$(window).trigger('action:composer.' + action, composerData);
		}
	}

	function showEmailConfirmAlert(err) {
		app.alert({
			id: 'email_confirm',
			title: '[[global:alert.error]]',
			message: err.message,
			type: 'danger',
			timeout: 0,
			clickfn: function() {
				app.removeAlert('email_confirm');
				socket.emit('user.emailConfirm', {}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[notifications:email-confirm-sent]]');
				});
			}
		});
	}

	function discard(post_uuid) {
		if (composer.posts[post_uuid]) {
			$('#cmp-uuid-' + post_uuid).remove();
			drafts.removeDraft(composer.posts[post_uuid].save_id);
			delete composer.posts[post_uuid];
			composer.active = undefined;
			taskbar.discard('composer', post_uuid);
			$('body').css({'margin-bottom': 0});
			$('.action-bar button').removeAttr('disabled');

			app.toggleNavbar(true);
			socket.emit('modules.composer.unregister', post_uuid);
		}
	}

	composer.minimize = function(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid);
		postContainer.css('visibility', 'hidden');
		composer.active = undefined;
		taskbar.minimize('composer', post_uuid);

		socket.emit('modules.composer.unregister', post_uuid);
	};

	return composer;
});
