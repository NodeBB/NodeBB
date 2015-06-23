'use strict';

/* globals define, socket, app, config, ajaxify, utils, templates, bootbox */

define('composer', [
	'taskbar',
	'translator',
	'composer/controls',
	'composer/uploads',
	'composer/formatting',
	'composer/drafts',
	'composer/tags',
	'composer/categoryList',
	'composer/preview',
	'composer/resize'
], function(taskbar, translator, controls, uploads, formatting, drafts, tags, categoryList, preview, resize) {
	var composer = {
		active: undefined,
		posts: {},
		bsEnvironment: undefined,
		formatting: []
	};

	$(window).off('resize', onWindowResize).on('resize', onWindowResize);

	$(window).on('action:composer.topics.post', function(ev, data) {
		localStorage.removeItem('category:' + data.data.cid + ':bookmark');
		localStorage.removeItem('category:' + data.data.cid + ':bookmark:clicked');
	});

	$(window).on('popstate', function(ev, data) {
		var env = utils.findBootstrapEnvironment();

		if (composer.active && (env === 'xs' || env ==='sm')) {
			if (!composer.posts[composer.active].modified) {
				discard(composer.active);
				return;
			}

			translator.translate('[[modules:composer.discard]]', function(translated) {
				bootbox.confirm(translated, function(confirm) {
					if (confirm) {
						discard(composer.active);
					}
				});
			});
		}
	});

	function removeComposerHistory() {
		var env = utils.findBootstrapEnvironment();
		if (env === 'xs' || env ==='sm') {
			history.back();
		}
	}

	// Query server for formatting options
	socket.emit('modules.composer.getFormattingOptions', function(err, options) {
		composer.formatting = options;
	});

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
		if (0 !== parseInt(app.user.uid, 10)) {
			if (post.hasOwnProperty('cid')) {
				post.save_id = ['composer', app.user.uid, 'cid', post.cid].join(':');
			} else if (post.hasOwnProperty('tid')) {
				post.save_id = ['composer', app.user.uid, 'tid', post.tid].join(':');
			} else if (post.hasOwnProperty('pid')) {
				post.save_id = ['composer', app.user.uid, 'pid', post.pid].join(':');
			}
		}

		composer.posts[uuid] = post;
		composer.load(uuid);
	}

	function composerAlert(post_uuid, message) {
		$('#cmp-uuid-' + post_uuid).find('.composer-submit').removeAttr('disabled');
		app.alert({
			type: 'danger',
			timeout: 3000,
			title: '',
			message: message,
			alert_id: 'post_error'
		});
	}

	composer.findByTid = function(tid) {
		// Iterates through the initialised composers and returns the uuid of the matching composer
		for(var uuid in composer.posts) {
			if (composer.posts.hasOwnProperty(uuid) && composer.posts[uuid].hasOwnProperty('tid') && parseInt(composer.posts[uuid].tid, 10) === parseInt(tid, 10)) {
				return uuid;
			}
		}

		return null;
	};

	composer.addButton = function(iconClass, onClick) {
		formatting.addButton(iconClass, onClick);
	};

	composer.newTopic = function(cid) {
		socket.emit('categories.isModerator', cid, function(err, isMod) {
			if (err) {
				return app.alertError(err.message);
			}
			push({
				cid: cid,
				title: '',
				body: '',
				modified: false,
				isMain: true,
				isMod: isMod
			});
		});
	};

	composer.addQuote = function(tid, topicSlug, postIndex, pid, title, username, text, uuid) {
		uuid = uuid || composer.active;

		if (uuid === undefined) {
			composer.newReply(tid, pid, title, '[[modules:composer.user_said, ' + username + ']]\n' + text);
			return;
		} else if (uuid !== composer.active) {
			// If the composer is not currently active, activate it
			composer.load(uuid);
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
		socket.emit('topics.isModerator', tid, function(err, isMod) {
			if (err) {
				return app.alertError(err.message);
			}
			translator.translate(text, config.defaultLang, function(translated) {
				push({
					tid: tid,
					toPid: pid,
					title: $('<div/>').text(title).html(),
					body: translated,
					modified: false,
					isMain: false,
					isMod: isMod
				});
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
				uid: threadData.uid,
				handle: threadData.handle,
				title: threadData.title,
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

		startNotifyTyping(composer.posts[post_uuid]);
	};

	function startNotifyTyping(postData) {
		function emit() {
			socket.emit('modules.composer.notifyTyping', {
				tid: postData.tid,
				uid: app.user.uid
			});
		}

		if (!parseInt(postData.tid, 10)) {
			return;
		}

		stopNotifyInterval(postData);

		emit();
		postData.notifyTypingIntervalId = setInterval(emit, 5000);
	}

	function stopNotifyTyping(postData) {
		if (!parseInt(postData.tid, 10)) {
			return;
		}
		socket.emit('modules.composer.stopNotifyTyping', {
			tid: postData.tid,
			uid: app.user.uid
		});
	}

	function stopNotifyInterval(postData) {
		if (postData.notifyTypingIntervalId) {
			clearInterval(postData.notifyTypingIntervalId);
			postData.notifyTypingIntervalId = 0;
		}
	}

	function createNewComposer(post_uuid) {
		var postData = composer.posts[post_uuid];

		var allowTopicsThumbnail = config.allowTopicsThumbnail && postData.isMain && (config.hasImageUploadPlugin || config.allowFileUploads),
			isTopic = postData ? !!postData.cid : false,
			isMain = postData ? !!postData.isMain : false,
			isEditing = postData ? !!postData.pid : false,
			isGuestPost = postData ? parseInt(postData.uid, 10) === 0 : false;

		composer.bsEnvironment = utils.findBootstrapEnvironment();

		// see
		// https://github.com/NodeBB/NodeBB/issues/2994 and
		// https://github.com/NodeBB/NodeBB/issues/1951
		// remove when 1951 is resolved

		var title = postData.title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

		var data = {
			title: title,
			mobile: composer.bsEnvironment === 'xs' || composer.bsEnvironment === 'sm',
			allowTopicsThumbnail: allowTopicsThumbnail,
			isTopicOrMain: isTopic || isMain,
			minimumTagLength: config.minimumTagLength,
			maximumTagLength: config.maximumTagLength,
			isTopic: isTopic,
			isEditing: isEditing,
			showHandleInput:  config.allowGuestHandles && (app.user.uid === 0 || (isEditing && isGuestPost && app.user.isAdmin)),
			handle: postData ? postData.handle || '' : undefined,
			formatting: composer.formatting,
			isAdminOrMod: app.user.isAdmin || postData.isMod
		};

		if (data.mobile) {
			var qs = '?p=' + window.location.pathname;
			ajaxify.go('compose', function() {
				renderComposer();
			}, false, qs);
		} else {
			renderComposer();
		}

		function renderComposer() {
			parseAndTranslate('composer', data, function(composerTemplate) {
				if ($('#cmp-uuid-' + post_uuid).length) {
					return;
				}
				composerTemplate = $(composerTemplate);

				composerTemplate.attr('id', 'cmp-uuid-' + post_uuid);

				$(document.body).append(composerTemplate);

				var postContainer = $(composerTemplate[0]),
					bodyEl = postContainer.find('textarea'),
					draft = drafts.getDraft(postData.save_id),
					submitBtn = postContainer.find('.composer-submit');

				preview.handleToggler(postContainer);
				tags.init(postContainer, composer.posts[post_uuid]);
				categoryList.init(postContainer, composer.posts[post_uuid]);

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

				submitBtn.on('click', function() {
					var action = $(this).attr('data-action');

					switch(action) {
						case 'post-lock':
							$(this).attr('disabled', true);
							post(post_uuid, {lock: true});
							break;

						case 'post':	// intentional fall-through
						default:
							$(this).attr('disabled', true);
							post(post_uuid);
							break;
					}
				});

				postContainer.on('click', 'a[data-switch-action]', function() {
					var action = $(this).attr('data-switch-action'),
						label = $(this).html();

					submitBtn.attr('data-action', action).html(label);
				});

				postContainer.find('.composer-discard').on('click', function() {
					if (!composer.posts[post_uuid].modified) {
						removeComposerHistory();
						discard(post_uuid);
						return;
					}
					var btn = $(this).prop('disabled', true);
					translator.translate('[[modules:composer.discard]]', function(translated) {
						bootbox.confirm(translated, function(confirm) {
							if (confirm) {
								removeComposerHistory();
								discard(post_uuid);
							}
							btn.prop('disabled', false);
						});
					});
				});

				postContainer.on('click', function() {
					if (!taskbar.isActive(post_uuid)) {
						taskbar.updateActive(post_uuid);
					}
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
					post_uuid: post_uuid,
					composerData: composer.posts[post_uuid]
				});

				formatting.addComposerButtons();
				focusElements(postContainer);
			});
		}
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

	function activate(post_uuid) {
		if(composer.active && composer.active !== post_uuid) {
			composer.minimize(composer.active);
		}

		composer.active = post_uuid;
	}

	function focusElements(postContainer) {
		var title = postContainer.find('input.title');
		if (title.length) {
			title.focus();
		} else {
			postContainer.find('textarea').focus().putCursorAtEnd();
		}
	}

	function post(post_uuid, options) {
		var postData = composer.posts[post_uuid],
			postContainer = $('#cmp-uuid-' + post_uuid),
			handleEl = postContainer.find('.handle'),
			titleEl = postContainer.find('.title'),
			bodyEl = postContainer.find('textarea'),
			thumbEl = postContainer.find('input#topic-thumb-url');

		options = options || {};

		titleEl.val(titleEl.val().trim());
		bodyEl.val(bodyEl.val().trim());
		if (thumbEl.length) {
			thumbEl.val(thumbEl.val().trim());
		}

		var checkTitle = (parseInt(postData.cid, 10) || parseInt(postData.pid, 10)) && postContainer.find('input.title').length;

		if (uploads.inProgress[post_uuid] && uploads.inProgress[post_uuid].length) {
			return composerAlert(post_uuid, '[[error:still-uploading]]');
		} else if (checkTitle && titleEl.val().length < parseInt(config.minimumTitleLength, 10)) {
			return composerAlert(post_uuid, '[[error:title-too-short, ' + config.minimumTitleLength + ']]');
		} else if (checkTitle && titleEl.val().length > parseInt(config.maximumTitleLength, 10)) {
			return composerAlert(post_uuid, '[[error:title-too-long, ' + config.maximumTitleLength + ']]');
		} else if (checkTitle && !utils.slugify(titleEl.val()).length) {
			return composerAlert(post_uuid, '[[error:invalid-title]]');
		} else if (bodyEl.val().length < parseInt(config.minimumPostLength, 10)) {
			return composerAlert(post_uuid, '[[error:content-too-short, ' + config.minimumPostLength + ']]');
		} else if (bodyEl.val().length > parseInt(config.maximumPostLength, 10)) {
			return composerAlert(post_uuid, '[[error:content-too-long, ' + config.maximumPostLength + ']]');
		}

		var composerData = {}, action;

		if (parseInt(postData.cid, 10) > 0) {
			action = 'topics.post';
			composerData = {
				handle: handleEl ? handleEl.val() : undefined,
				title: titleEl.val(),
				content: bodyEl.val(),
				topic_thumb: thumbEl.val() || '',
				category_id: postData.cid,
				tags: tags.getTags(post_uuid),
				lock: options.lock || false
			};
		} else if (parseInt(postData.tid, 10) > 0) {
			action = 'posts.reply';
			composerData = {
				tid: postData.tid,
				handle: handleEl ? handleEl.val() : undefined,
				content: bodyEl.val(),
				toPid: postData.toPid,
				lock: options.lock || false
			};
		} else if (parseInt(postData.pid, 10) > 0) {
			action = 'posts.edit';
			composerData = {
				pid: postData.pid,
				handle: handleEl ? handleEl.val() : undefined,
				content: bodyEl.val(),
				title: titleEl.val(),
				topic_thumb: thumbEl.val() || '',
				tags: tags.getTags(post_uuid)
			};
		}

		socket.emit(action, composerData, function (err, data) {
			postContainer.find('.composer-submit').removeAttr('disabled');
			if (err) {
				if (err.message === '[[error:email-not-confirmed]]') {
					return app.showEmailConfirmWarning(err);
				}

				return app.alertError(err.message);
			}

			discard(post_uuid);
			drafts.removeDraft(postData.save_id);

			if (action === 'topics.post') {
				ajaxify.go('topic/' + data.slug);
			} else {
				removeComposerHistory();
			}

			$(window).trigger('action:composer.' + action, {composerData: composerData, data: data});
		});
	}

	function discard(post_uuid) {
		if (composer.posts[post_uuid]) {
			$('#cmp-uuid-' + post_uuid).remove();
			drafts.removeDraft(composer.posts[post_uuid].save_id);
			stopNotifyInterval(composer.posts[post_uuid]);
			stopNotifyTyping(composer.posts[post_uuid]);

			delete composer.posts[post_uuid];
			composer.active = undefined;
			taskbar.discard('composer', post_uuid);
			$('body').css({'margin-bottom': 0});
			$('[data-action="post"]').removeAttr('disabled');


			$('html').removeClass('composing mobile');

		}
	}

	composer.minimize = function(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid);
		postContainer.css('visibility', 'hidden');
		composer.active = undefined;
		taskbar.minimize('composer', post_uuid);

		stopNotifyInterval(composer.posts[post_uuid]);
		stopNotifyTyping(composer.posts[post_uuid]);

		$('body').css({'margin-bottom': '0px'});
	};

	return composer;
});
