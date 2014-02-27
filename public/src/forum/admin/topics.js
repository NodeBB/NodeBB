define(function() {
	var	Topics = {};

	Topics.init = function() {
		var topicsListEl = $('.topics'),
			loadMoreEl = $('#topics_loadmore');

		this.resolveButtonStates();

		topicsListEl.on('click', '[data-action]', function() {
			var $this = $(this),
				action = $this.attr('data-action'),
				tid = $this.parents('[data-tid]').attr('data-tid');

			switch (action) {
				case 'pin':
					if (!$this.hasClass('active')) {
						socket.emit('topics.pin', tid, Topics.pin);
					} else {
						socket.emit('topics.unpin', tid, Topics.unpin);
					}
					break;

				case 'lock':
					if (!$this.hasClass('active')) {
						socket.emit('topics.lock', tid, Topics.lock);
					} else {
						socket.emit('topics.unlock', tid, Topics.unlock);
					}
					break;

				case 'delete':
					if (!$this.hasClass('active')) {
						socket.emit('topics.delete', tid, Topics.setDeleted);
					} else {
						socket.emit('topics.restore', tid, Topics.restore);
					}
					break;

			}
		});

		loadMoreEl.on('click', function() {
			if (!$(this).hasClass('disabled')) {
				var topics = $('.topics li[data-tid]');

				if(!topics.length) {
					return;
				}

				var lastTid = parseInt(topics.eq(topics.length - 1).attr('data-tid'));

				$(this).html('<i class="fa fa-refresh fa-spin"></i> Retrieving topics');
				socket.emit('admin.topics.getMore', {
					limit: 10,
					after: lastTid
				}, function(err, topics) {
					if(err) {
						return app.alertError(err.message);
					}

					var btnEl = $('#topics_loadmore');

					if (topics.length > 0) {
						var html = templates.prepare(templates['admin/topics'].blocks['topics']).parse({
								topics: topics
							}),
							topicsListEl = $('.topics');

						// Fix relative paths
						html = html.replace(/\{relative_path\}/g, RELATIVE_PATH);

						topicsListEl.html(topicsListEl.html() + html);

						Topics.resolveButtonStates();

						btnEl.html('Load More Topics');
						$('span.timeago').timeago();
					} else {
						// Exhausted all topics
						btnEl.addClass('disabled');
						btnEl.html('No more topics');
					}
				});
			}
		}, false);
	};

	Topics.resolveButtonStates = function() {
		// Resolve proper button state for all topics
		var topicsListEl = $('.topics'),
			topicEls = topicsListEl.find('li'),
			numTopics = topicEls.length;

		for (var x = 0; x < numTopics; x++) {
			var topic = topicEls.eq(x);
			if (topic.attr('data-pinned') === '1') {
				topic.find('[data-action="pin"]').addClass('active');
				topic.removeAttr('data-pinned');
			}
			if (topic.attr('data-locked') === '1') {
				topic.find('[data-action="lock"]').addClass('active');
				topic.removeAttr('data-locked');
			}
			if (topic.attr('data-deleted') === '1') {
				topic.find('[data-action="delete"]').addClass('active');
				topic.removeAttr('data-deleted');
			}
		}
	};

	Topics.setDeleted = function(err, response) {
		if(err) {
			return app.alert(err.message);
		}

		if (response && response.tid) {
			var btnEl = $('li[data-tid="' + response.tid + '"] button[data-action="delete"]');
			btnEl.addClass('active');
			btnEl.siblings('[data-action="lock"]').addClass('active');
		}
	};

	Topics.restore = function(err, response) {
		if(err) {
			return app.alert(err.message);
		}

		if (response && response.tid) {
			var btnEl = $('li[data-tid="' + response.tid + '"] button[data-action="delete"]');

			btnEl.removeClass('active');
			btnEl.siblings('[data-action="lock"]').removeClass('active');
		}
	};

	Topics.lock = function(err, response) {
		if(err) {
			return app.alert(err.message);
		}

		if (response && response.tid) {
			var btnEl = $('li[data-tid="' + response.tid + '"] button[data-action="lock"]');

			btnEl.addClass('active');
		}
	};

	Topics.unlock = function(err, response) {
		if(err) {
			return app.alert(err.message);
		}

		if (response && response.tid) {
			var btnEl = $('li[data-tid="' + response.tid + '"] button[data-action="lock"]');

			btnEl.removeClass('active');
		}
	};


	Topics.unpin = function(err, response) {
		if(err) {
			return app.alert(err.message);
		}

		if (response && response.tid) {
			var btnEl = $('li[data-tid="' + response.tid + '"] button[data-action="pin"]');

			btnEl.removeClass('active');
		}
	};

	Topics.pin = function(err, response) {
		if(err) {
			return app.alert(err.message);
		}

		if (response && response.tid) {
			var btnEl = $('li[data-tid="' + response.tid + '"] button[data-action="pin"]');

			btnEl.addClass('active');
		}
	};

	return Topics;
});