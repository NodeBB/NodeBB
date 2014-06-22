'use strict';

/* globals define, socket, app, config, ajaxify, utils, translator, templates, bootbox */

var dependencies = [
	'taskbar',
	'composer/controls',
	'composer/uploads',
	'composer/formatting',
	'composer/drafts',
	'composer/tags',
	'composer/preview'
];

define('composer', dependencies, function(taskbar, controls, uploads, formatting, drafts, tags, preview) {
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
			activateReposition(composer.active);
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

	composer.addQuote = function(tid, pid, title, username, text){
		var uuid = composer.active;

		if(uuid === undefined){
			translator.translate('[[modules:composer.user_said, ' + username + ']]', function(translated) {
				composer.newReply(tid, pid, title, translated + text);
			});
			return;
		}

		var bodyEl = $('#cmp-uuid-'+uuid).find('textarea');
		var prevText = bodyEl.val();
		if(tid !== composer.posts[uuid].tid) {
			var link = '[' + title + '](/topic/' + tid + '#' + pid + ')';
			translator.translate('[[modules:composer.user_said_in, ' + username + ', ' + link + ']]', onTranslated);
		} else {
			translator.translate('[[modules:composer.user_said, ' + username + ']]', onTranslated);
		}

		function onTranslated(translated) {
			composer.posts[uuid].body = (prevText.length ? prevText + '\n\n' : '') + translated + text;
			bodyEl.val(composer.posts[uuid].body);
		}
	};

	composer.newReply = function(tid, pid, title, text) {
		push({
			tid: tid,
			toPid: pid,
			title: title,
			body: text,
			modified: false,
			isMain: false
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
		if($('#cmp-uuid-' + post_uuid).length) {
			activateReposition(post_uuid);
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

		composer.bsEnvironment = utils.findBootstrapEnvironment()

		var template = (composer.bsEnvironment === 'xs' || composer.bsEnvironment === 'sm') ? 'composer-mobile' : 'composer';

		templates.parse(template, {allowTopicsThumbnail: allowTopicsThumbnail, showTags: isTopic || isMain}, function(composerTemplate) {
			translator.translate(composerTemplate, function(composerTemplate) {
				composerTemplate = $(composerTemplate);

				composerTemplate.attr('id', 'cmp-uuid-' + post_uuid);

				$(document.body).append(composerTemplate);

				var postContainer = $(composerTemplate[0]);

				tags.init(postContainer, composer.posts[post_uuid]);

				activateReposition(post_uuid);

				if(config.allowFileUploads || config.hasImageUploadPlugin) {
					uploads.initialize(post_uuid);
				}

				formatting.addHandler(postContainer);

				var postData = composer.posts[post_uuid],
					bodyEl = postContainer.find('textarea'),
					draft = drafts.getDraft(postData.save_id);

				updateTitle(postData, postContainer);

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
					if (composer.posts[post_uuid].modified) {
						bootbox.confirm('Are you sure you wish to discard this post?', function(confirm) {
							if (confirm) {
								discard(post_uuid);
							}
						});
					} else {
						discard(post_uuid);
					}
				});

				postContainer.find('.nav-tabs a').click(function (e) {
					e.preventDefault();
					$(this).tab('show');
					var selector = $(this).attr('data-pane');
					postContainer.find('.tab-content div').removeClass('active');
					postContainer.find(selector).addClass('active');
					if(selector === '.tab-write') {
						bodyEl.focus();
					}
					return false;
				});

				bodyEl.on('input propertychange', function() {
					preview.render(postContainer);
				});

				bodyEl.on('scroll', function() {
					preview.matchScroll(postContainer);
				})

				bodyEl.val(draft ? draft : postData.body);
				preview.render(postContainer, function() {
					preview.matchScroll(postContainer);
				});
				drafts.init(postContainer, postData);

				handleResize(postContainer);

				socket.emit('modules.composer.renderHelp', function(err, html) {
					if (!err && html && html.length > 0) {
						postContainer.find('.help').html(html);
						postContainer.find('[data-pane=".tab-help"]').parent().removeClass('hidden');
					}
				});

				$(window).trigger('action:composer.loaded', {
					post_uuid: post_uuid
				});

				formatting.addComposerButtons();

			});
		});
	}

	function updateTitle(postData, postContainer) {
		var titleEl = postContainer.find('.title');

		if (parseInt(postData.tid, 10) > 0) {
			translator.translate('[[topic:composer.replying_to, ' + postData.title + ']]', function(newTitle) {
				titleEl.val(newTitle);
			});
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

	function handleResize(postContainer) {
		var	resizeActive = false,
			resizeOffset = 0,
			resizeStart = function(e) {
				var resizeRect = resizeEl[0].getBoundingClientRect();
				var resizeCenterY = resizeRect.top + (resizeRect.height/2);
				resizeOffset = resizeCenterY - e.clientY;
				resizeActive = true;

				$(window).on('mousemove', resizeAction);
				$(window).on('mouseup', resizeStop);
				$('body').on('touchmove', resizeTouchAction);
			},
			resizeStop = function() {
				resizeActive = false;
				postContainer.find('textarea').focus();
				$(window).off('mousemove', resizeAction);
				$(window).off('mouseup', resizeStop);
				$('body').off('touchmove', resizeTouchAction);
			},
			resizeTouchAction = function(e) {
				e.preventDefault();
				resizeAction(e.touches[0]);
			},
			resizeAction = function(e) {
				if (resizeActive) {
					var position = (e.clientY + resizeOffset);
					var newHeight = $(window).height() - position;

					if(newHeight > $(window).height() - $('#header-menu').height() - 20) {
						newHeight = $(window).height() - $('#header-menu').height() - 20;
					} else if (newHeight < 100) {
						newHeight = 100;
					}

					postContainer.css('height', newHeight);
					$('body').css({'margin-bottom': newHeight});
					resizeTabContent(postContainer);
					resizeSavePosition(newHeight);
				}
				e.preventDefault();
				return false;
			},
			resizeSavePosition = function(px) {
				var	percentage = px / $(window).height();
				localStorage.setItem('composer:resizePercentage', percentage);
			};

		var resizeEl = postContainer.find('.resizer');

		resizeEl.on('mousedown', resizeStart);

		resizeEl.on('touchstart', function(e) {
			e.preventDefault();
			resizeStart(e.touches[0]);
		});

		resizeEl.on('touchend', function(e) {
			e.preventDefault();
			resizeStop();
		});
	}

	function activateReposition(post_uuid) {
		if(composer.active && composer.active !== post_uuid) {
			composer.minimize(composer.active);
		}

		var	percentage = localStorage.getItem('composer:resizePercentage'),
			postContainer = $('#cmp-uuid-' + post_uuid);

		composer.active = post_uuid;
		var env = composer.bsEnvironment;

		if (percentage) {
			if ( env === 'md' || env === 'lg') {
				postContainer.css('height', Math.floor($(window).height() * percentage) + 'px');
			}
		}

		if(env === 'sm' || env === 'xs') {
			postContainer.css('height', $(window).height() - $('#header-menu').height());
		}

		if(config.hasImageUploadPlugin) {
			if(env === 'md' || env === 'lg') {
				postContainer.find('.upload-instructions').removeClass('hide');
			}
			postContainer.find('.img-upload-btn').removeClass('hide');
			postContainer.find('#files.lt-ie9').removeClass('hide');
		}

		if(config.allowFileUploads) {
			postContainer.find('.file-upload-btn').removeClass('hide');
			postContainer.find('#files.lt-ie9').removeClass('hide');
		}

		postContainer.css('visibility', 'visible')
			.css('z-index', 2);

		$('body').css({'margin-bottom': postContainer.css('height')});

		if (env !== 'sm' && env !== 'xs') {
			focusElements(post_uuid);
		}

		resizeTabContent(postContainer);
	}

	function resizeTabContent(postContainer) {
		var h1 = postContainer.find('.title').outerHeight(true);
		var h2 = postContainer.find('.tags-container').outerHeight(true);
		var h3 = postContainer.find('.formatting-bar').outerHeight(true);
		var h4 = postContainer.find('.nav-tabs').outerHeight(true);
		var h5 = postContainer.find('.instructions').outerHeight(true);
		var h6 = postContainer.find('.topic-thumb-container').outerHeight(true);
		var h7 = $('.taskbar').height();
		var total = h1 + h2 + h3 + h4 + h5 + h6 + h7;
		postContainer.find('.tab-content').css('height', postContainer.height() - total);
	}

	function focusElements(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid),
			postData = composer.posts[post_uuid],
			bodyEl = postContainer.find('textarea');

		if ((parseInt(postData.tid, 10) || parseInt(postData.pid, 10)) > 0) {
			bodyEl.focus();
			bodyEl.selectionStart = bodyEl.val().length;
			bodyEl.selectionEnd = bodyEl.val().length;
		} else if (parseInt(postData.cid, 10) > 0) {
			postContainer.find('.title').focus();
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

		if (parseInt(postData.cid, 10) > 0) {
			socket.emit('topics.post', {
				title: titleEl.val(),
				content: bodyEl.val(),
				topic_thumb: thumbEl.val() || '',
				category_id: postData.cid,
				tags: tags.getTags(post_uuid)
			}, function(err, topic) {
				done(err);
				if (!err) {
					ajaxify.go('topic/' + topic.slug);
				}
			});
		} else if (parseInt(postData.tid, 10) > 0) {
			socket.emit('posts.reply', {
				tid: postData.tid,
				content: bodyEl.val(),
				toPid: postData.toPid
			}, done);
		} else if (parseInt(postData.pid, 10) > 0) {
			socket.emit('posts.edit', {
				pid: postData.pid,
				content: bodyEl.val(),
				title: titleEl.val(),
				topic_thumb: thumbEl.val() || '',
				tags: tags.getTags(post_uuid)
			}, done);
		}

		function done(err) {
			$('.action-bar button').removeAttr('disabled');
			if (err) {
				return app.alertError(err.message);
			}

			discard(post_uuid);
			drafts.removeDraft(postData.save_id);
		}
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
