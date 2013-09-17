$(document).ready(function() {
	var topicsListEl = document.querySelector('.topics'),
		loadMoreEl = document.getElementById('topics_loadmore');

	$(topicsListEl).on('click', '[data-action]', function() {
		var $this = $(this),
			action = this.getAttribute('data-action'),
			tid = $this.parents('[data-tid]').attr('data-tid');

		switch (action) {
			case 'pin':
				if (!$this.hasClass('active')) socket.emit('api:topic.pin', {
					tid: tid
				});
				else socket.emit('api:topic.unpin', {
					tid: tid
				});
				break;
			case 'lock':
				if (!$this.hasClass('active')) socket.emit('api:topic.lock', {
					tid: tid
				});
				else socket.emit('api:topic.unlock', {
					tid: tid
				});
				break;
			case 'delete':
				if (!$this.hasClass('active')) socket.emit('api:topic.delete', {
					tid: tid
				});
				else socket.emit('api:topic.restore', {
					tid: tid
				});
				break;
		}
	});

	loadMoreEl.addEventListener('click', function() {
		if (this.className.indexOf('disabled') === -1) {
			var topics = document.querySelectorAll('.topics li[data-tid]'),
				lastTid = parseInt(topics[topics.length - 1].getAttribute('data-tid'));

			this.innerHTML = '<i class="icon-refresh icon-spin"></i> Retrieving topics';
			socket.emit('api:admin.topics.getMore', {
				limit: 10,
				after: lastTid
			}, function(topics) {
				var btnEl = document.getElementById('topics_loadmore');

				topics = JSON.parse(topics);
				if (topics.length > 0) {
					var html = templates.prepare(templates['admin/topics'].blocks['topics']).parse({
						topics: topics
					}),
						topicsListEl = document.querySelector('.topics');

					topicsListEl.innerHTML += html;
					btnEl.innerHTML = 'Load More Topics';
				} else {
					// Exhausted all topics
					btnEl.className += ' disabled';
					btnEl.innerHTML = 'No more topics';
				}
			});
		}
	}, false);

	// Resolve proper button state for all topics
	var topicEls = topicsListEl.querySelectorAll('li'),
		numTopics = topicEls.length;
	for (var x = 0; x < numTopics; x++) {
		if (topicEls[x].getAttribute('data-pinned') === '1') topicEls[x].querySelector('[data-action="pin"]').className += ' active';
		if (topicEls[x].getAttribute('data-locked') === '1') topicEls[x].querySelector('[data-action="lock"]').className += ' active';
		if (topicEls[x].getAttribute('data-deleted') === '1') topicEls[x].querySelector('[data-action="delete"]').className += ' active';
		topicEls[x].removeAttribute('data-pinned');
		topicEls[x].removeAttribute('data-locked');
		topicEls[x].removeAttribute('data-deleted');
	}
});

socket.on('api:topic.pin', function(response) {
	if (response.status === 'ok') {
		var btnEl = document.querySelector('li[data-tid="' + response.tid + '"] button[data-action="pin"]');

		$(btnEl).addClass('active');
	}
});

socket.on('api:topic.unpin', function(response) {
	if (response.status === 'ok') {
		var btnEl = document.querySelector('li[data-tid="' + response.tid + '"] button[data-action="pin"]');

		$(btnEl).removeClass('active');
	}
});

socket.on('api:topic.lock', function(response) {
	if (response.status === 'ok') {
		var btnEl = document.querySelector('li[data-tid="' + response.tid + '"] button[data-action="lock"]');

		$(btnEl).addClass('active');
	}
});

socket.on('api:topic.unlock', function(response) {
	if (response.status === 'ok') {
		var btnEl = document.querySelector('li[data-tid="' + response.tid + '"] button[data-action="lock"]');

		$(btnEl).removeClass('active');
	}
});

socket.on('api:topic.delete', function(response) {
	if (response.status === 'ok') {
		var btnEl = document.querySelector('li[data-tid="' + response.tid + '"] button[data-action="delete"]');

		$(btnEl).addClass('active');
	}
});

socket.on('api:topic.restore', function(response) {
	if (response.status === 'ok') {
		var btnEl = document.querySelector('li[data-tid="' + response.tid + '"] button[data-action="delete"]');

		$(btnEl).removeClass('active');
	}
});