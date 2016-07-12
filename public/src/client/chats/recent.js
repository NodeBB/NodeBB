'use strict';

/* globals define, socket, app */

define('forum/chats/recent', function() {

	var recent = {};

	recent.init = function() {
		$('[component="chat/recent"]').on('scroll', function() {
			var $this = $(this);
			var bottom = ($this[0].scrollHeight - $this.height()) * 0.9;
			if ($this.scrollTop() > bottom) {
				loadMoreRecentChats();
			}
		});
	};

	function loadMoreRecentChats() {
		var recentChats = $('[component="chat/recent"]');
		if (recentChats.attr('loading')) {
			return;
		}
		recentChats.attr('loading', 1);
		socket.emit('modules.chats.getRecentChats', {
			after: recentChats.attr('data-nextstart')
		}, function(err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			if (data && data.rooms.length) {
				onRecentChatsLoaded(data, function() {
					recentChats.removeAttr('loading');
					recentChats.attr('data-nextstart', data.nextStart);
				});
			} else {
				recentChats.removeAttr('loading');
			}
		});
	}

	function onRecentChatsLoaded(data, callback) {
		if (!data.rooms.length) {
			return callback();
		}

		app.parseAndTranslate('chats', 'rooms', data, function(html) {
			$('[component="chat/recent"]').append(html);
			html.find('.timeago').timeago();
			callback();
		});
	}


	return recent;
});