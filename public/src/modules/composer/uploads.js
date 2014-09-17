'use strict';

/* globals define, utils, config, app */

define('composer/uploads', ['composer/preview'], function(preview) {
	var uploads = {
		inProgress: {}
	};

	uploads.initialize = function(post_uuid) {

		initializeDragAndDrop(post_uuid);
		initializePaste(post_uuid);

		addChangeHandlers(post_uuid);
		addTopicThumbHandlers(post_uuid);
	};

	function addChangeHandlers(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid);

		postContainer.find('#files').on('change', function(e) {
			var files = (e.target || {}).files || ($(this).val() ? [{name: $(this).val(), type: utils.fileMimeType($(this).val())}] : null);
			if(files) {
				uploadContentFiles({files: files, post_uuid: post_uuid, route: '/api/post/upload'});
			}
		});

		postContainer.find('#topic-thumb-file').on('change', function(e) {
			var files = (e.target || {}).files || ($(this).val() ? [{name: $(this).val(), type: utils.fileMimeType($(this).val())}] : null),
				fd;

			if(files) {
				if (window.FormData) {
					fd = new FormData();
					for (var i = 0; i < files.length; ++i) {
						fd.append('files[]', files[i], files[i].name);
					}
				}
				uploadTopicThumb({files: files, post_uuid: post_uuid, route: '/api/topic/thumb/upload', formData: fd});
			}
		});
	}

	function addTopicThumbHandlers(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid);

		postContainer.on('click', '.topic-thumb-clear-btn', function(e) {
			postContainer.find('input#topic-thumb-url').val('').trigger('change');
			resetInputFile(postContainer.find('input#topic-thumb-file'));
			$(this).addClass('hide');
			e.preventDefault();
		});

		postContainer.on('paste change keypress', 'input#topic-thumb-url', function() {
			var urlEl = $(this);
			setTimeout(function(){
				var url = urlEl.val();
				if (url) {
					postContainer.find('.topic-thumb-clear-btn').removeClass('hide');
				} else {
					resetInputFile(postContainer.find('input#topic-thumb-file'));
					postContainer.find('.topic-thumb-clear-btn').addClass('hide');
				}
				postContainer.find('img.topic-thumb-preview').attr('src', url);
			}, 100);
		});
	}

	uploads.toggleThumbEls = function(postContainer, url) {
		var thumbToggleBtnEl = postContainer.find('.topic-thumb-toggle-btn');

		postContainer.find('input#topic-thumb-url').val(url);
		postContainer.find('img.topic-thumb-preview').attr('src', url);
		if (url) {
			postContainer.find('.topic-thumb-clear-btn').removeClass('hide');
		}
		thumbToggleBtnEl.removeClass('hide');
		thumbToggleBtnEl.off('click').on('click', function() {
			var container = postContainer.find('.topic-thumb-container');
			container.toggleClass('hide', !container.hasClass('hide'));
		});
	};

	function resetInputFile($el) {
		$el.wrap('<form />').closest('form').get(0).reset();
		$el.unwrap();
	}

	function initializeDragAndDrop(post_uuid) {

		function onDragEnter() {
			if(draggingDocument) {
				return;
			}
			drop.css('top', postContainer.find('.write-preview-container').position().top + 'px');
			drop.css('height', textarea.height());
			drop.css('line-height', textarea.height() + 'px');
			drop.show();

			drop.on('dragleave', function() {
				drop.hide();
				drop.off('dragleave');
			});
		}

		function onDragDrop(e) {
			e.preventDefault();
			var files = e.files || (e.dataTransfer || {}).files || (e.target.value ? [e.target.value] : []),
				fd;

			if(files.length) {
				if (window.FormData) {
					fd = new FormData();
					for (var i = 0; i < files.length; ++i) {
						fd.append('files[]', files[i], files[i].name);
					}
				}

				uploadContentFiles({
					files: files,
					post_uuid: post_uuid,
					route: '/api/post/upload',
					formData: fd
				});
			}

			drop.hide();
			return false;
		}

		function cancel(e) {
			e.preventDefault();
			return false;
		}

		if($.event.props.indexOf('dataTransfer') === -1) {
			$.event.props.push('dataTransfer');
		}

		var draggingDocument = false;

		var postContainer = $('#cmp-uuid-' + post_uuid),
			drop = postContainer.find('.imagedrop'),
			textarea = postContainer.find('textarea');

		$(document).off('dragstart').on('dragstart', function() {
			draggingDocument = true;
		}).off('dragend').on('dragend', function() {
			draggingDocument = false;
		});

		textarea.on('dragenter', onDragEnter);

		drop.on('dragover', cancel);
		drop.on('dragenter', cancel);
		drop.on('drop', onDragDrop);
	}

	function initializePaste(post_uuid) {
		$(window).off('paste').on('paste', function(event) {

			var items = (event.clipboardData || event.originalEvent.clipboardData || {}).items,
				fd;

			if(items && items.length) {

				var blob = items[0].getAsFile();
				if(blob) {
					blob.name = 'upload-' + utils.generateUUID();

					if (window.FormData) {
						fd = new FormData();
						fd.append('files[]', blob, blob.name);
					}

					uploadContentFiles({
						files: [blob],
						post_uuid: post_uuid,
						route: '/api/post/upload',
						formData: fd
					});
				}
			}
		});
	}

	function escapeRegExp(text) {
		return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
	}

	function maybeParse(response) {
		if (typeof response === 'string')  {
			try {
				return $.parseJSON(response);
			} catch (e) {
				return {status: 500, message: 'Something went wrong while parsing server response'};
			}
		}
		return response;
	}

	function insertText(str, index, insert) {
		return str.slice(0, index) + insert + str.slice(index);
	};

	function uploadContentFiles(params) {
		var files = params.files,
			post_uuid = params.post_uuid,
			formData = params.formData,
			postContainer = $('#cmp-uuid-' + post_uuid),
			textarea = postContainer.find('textarea'),
			text = textarea.val(),
			uploadForm = postContainer.find('#fileForm');

		uploadForm.attr('action', params.route);

		for(var i = 0; i < files.length; ++i) {
			var isImage = files[i].type.match(/image./);

			text = insertText(text, textarea.getCursorPosition(), (isImage ? '!' : '') + '[' + files[i].name + '](uploading...) ');

			if(files[i].size > parseInt(config.maximumFileSize, 10) * 1024) {
				uploadForm[0].reset();
				return app.alertError('[[error:file-too-big, ' + config.maximumFileSize + ']]');
			}
		}

		textarea.val(text);

		uploadForm.off('submit').submit(function() {
			function updateTextArea(filename, text) {
				var current = textarea.val();
				var re = new RegExp(escapeRegExp(filename) + "]\\([^)]+\\)", 'g');
				textarea.val(current.replace(re, filename + '](' + text + ')'));
			}

			$(this).find('#postUploadCsrf').val($('#csrf').attr('data-csrf'));

			if (formData) {
				formData.append('_csrf', $('#csrf').attr('data-csrf'));
			}

			uploads.inProgress[post_uuid] = uploads.inProgress[post_uuid] || [];
			uploads.inProgress[post_uuid].push(1);

			$(this).ajaxSubmit({
				resetForm: true,
				clearForm: true,
				formData: formData,

				error: onUploadError,

				uploadProgress: function(event, position, total, percent) {
					for(var i=0; i < files.length; ++i) {
						updateTextArea(files[i].name, 'uploading ' + percent + '%');
					}
				},

				success: function(uploads) {
					uploads = maybeParse(uploads);

					if(uploads && uploads.length) {
						for(var i=0; i<uploads.length; ++i) {
							updateTextArea(uploads[i].name, uploads[i].url);
						}
					}
					preview.render(postContainer);
					textarea.focus();
				},

				complete: function() {
					uploadForm[0].reset();
					uploads.inProgress[post_uuid].pop();
				}
			});

			return false;
		});

		uploadForm.submit();
	}

	function uploadTopicThumb(params) {
		var post_uuid = params.post_uuid,
			formData = params.formData,
			postContainer = $('#cmp-uuid-' + post_uuid),
			spinner = postContainer.find('.topic-thumb-spinner'),
			thumbForm = postContainer.find('#thumbForm');

		thumbForm.attr('action', params.route);

		thumbForm.off('submit').submit(function() {
			var csrf = $('#csrf').attr('data-csrf');
			$(this).find('#thumbUploadCsrf').val(csrf);

			if(formData) {
				formData.append('_csrf', csrf);
			}

			spinner.removeClass('hide');

			uploads.inProgress[post_uuid] = uploads.inProgress[post_uuid] || [];
			uploads.inProgress[post_uuid].push(1);

			$(this).ajaxSubmit({
				formData: formData,
				error: onUploadError,
				success: function(uploads) {
					uploads = maybeParse(uploads);

					postContainer.find('#topic-thumb-url').val((uploads[0] || {}).url || '').trigger('change');
				},
				complete: function() {
					uploads.inProgress[post_uuid].pop();
					spinner.addClass('hide');
				}
			});
			return false;
		});
		thumbForm.submit();
	}

	function onUploadError(xhr) {
		xhr = maybeParse(xhr);

		app.alertError('[[error:upload-error, ' + xhr.responseText + ']]');
	}

	return uploads;
});

