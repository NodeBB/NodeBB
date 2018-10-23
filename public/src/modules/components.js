'use strict';

define('components', function () {
	var components = {};

	components.core = {
		'topic/teaser': function (tid) {
			if (tid) {
				return $('[component="category/topic"][data-tid="' + tid + '"] [component="topic/teaser"]');
			}
			return $('[component="topic/teaser"]');
		},
		topic: function (name, value) {
			return $('[component="topic"][data-' + name + '="' + value + '"]');
		},
		post: function (name, value) {
			return $('[component="post"][data-' + name + '="' + value + '"]');
		},
		'post/content': function (pid) {
			return $('[component="post"][data-pid="' + pid + '"] [component="post/content"]');
		},
		'post/header': function (pid) {
			return $('[component="post"][data-pid="' + pid + '"] [component="post/header"]');
		},
		'post/anchor': function (index) {
			return $('[component="post"][data-index="' + index + '"] [component="post/anchor"]');
		},
		'post/vote-count': function (pid) {
			return $('[component="post"][data-pid="' + pid + '"] [component="post/vote-count"]');
		},
		'post/bookmark-count': function (pid) {
			return $('[component="post"][data-pid="' + pid + '"] [component="post/bookmark-count"]');
		},

		'user/postcount': function (uid) {
			return $('[component="user/postcount"][data-uid="' + uid + '"]');
		},
		'user/reputation': function (uid) {
			return $('[component="user/reputation"][data-uid="' + uid + '"]');
		},

		'category/topic': function (name, value) {
			return $('[component="category/topic"][data-' + name + '="' + value + '"]');
		},

		'categories/category': function (name, value) {
			return $('[component="categories/category"][data-' + name + '="' + value + '"]');
		},

		'chat/message': function (messageId) {
			return $('[component="chat/message"][data-mid="' + messageId + '"]');
		},

		'chat/message/body': function (messageId) {
			return $('[component="chat/message"][data-mid="' + messageId + '"] [component="chat/message/body"]');
		},

		'chat/recent/room': function (roomid) {
			return $('[component="chat/recent/room"][data-roomid="' + roomid + '"]');
		},
	};

	components.get = function () {
		var args = Array.prototype.slice.call(arguments, 1);

		if (components.core[arguments[0]] && args.length) {
			return components.core[arguments[0]].apply(this, args);
		}
		return $('[component="' + arguments[0] + '"]');
	};

	return components;
});
