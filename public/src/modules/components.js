"use strict";
define('components', function() {
	var components = {};

	components.core = {
		'post': function(name, value) {
			return $('[component="post"][data-' + name + '="' + value + '"]');
		},
		'post/content': function(pid) {
			return components.core.post('pid', pid).find('[component="post/content"]');
		},
		'post/header': function(pid) {
			return components.core.post('pid', pid).find('[component="post/header"]');
		},
		'post/anchor': function(index) {
			return components.core.post('index', index).find('[component="post/anchor"]');
		},
		'post/vote-count': function(pid) {
			return components.core.post('pid', pid).find('[component="post/vote-count"]');
		},
		'post/favourite-count': function(pid) {
			return components.core.post('pid', pid).find('[component="post/favourite-count"]');
		},

		'user/postcount': function(uid) {
			return $('[component="user/postcount"][data-uid="' + uid + '"]');
		},
		'user/reputation': function(uid) {
			return $('[component="user/reputation"][data-uid="' + uid + '"]');
		},

		'category/topic': function(name, value) {
			return $('[component="category/topic"][data-' + name + '="' + value + '"]');
		},

		'categories/category': function(name, value) {
			return $('[component="categories/category"][data-' + name + '="' + value + '"]');
		}
	};

	components.get = function() {
		var args = Array.prototype.slice.call(arguments, 1);

		if (components.core[arguments[0]] && args.length) {
			return components.core[arguments[0]].apply(this, args);
		} else {
			return $('[component="' + arguments[0] + '"]');
		}
	};

	return components;
});