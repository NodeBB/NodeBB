"use strict";

var components = components || {};

(function() {
	components.core = {
		'post': function(name, value) {
			return $('[data-' + name + '="' + value + '"]');
		},
		'post/content': function(pid) {
			var el = components.core.post('pid', pid).find('[component="post/content"]');
			return el.length ? el : $('#content_' + pid); // deprecated after 0.7x
		},
		'post/header': function(pid) {
			var el = components.core.post('pid', pid).find('[component="post/header"]');
			return el.length ? el : $('#topic_title_' + pid); // deprecated after 0.7x	
		},
		'post/anchor': function(index) {
			var el = components.core.post('index', index).find('[component="post/anchor"]');
			return el.length ? el : $('#post_anchor_' + index); // deprecated after 0.7x	
		},
		'post/vote-count': function(pid) {
			var el = components.core.post('pid', pid).find('[component="post/vote-count"]');
			return el.length ? el : components.core.post('pid', pid).find('.votes'); // deprecated after 0.7x	
		},
		'post/favourite-count': function(pid) {
			var el = components.core.post('pid', pid).find('[component="post/favourite-count"]');
			return el.length ? el : components.core.post('pid', pid).find('.favouriteCount'); // deprecated after 0.7x	
		},

		'user/postcount': function(uid) {
			var el = $('[component="user/postcount"][data-uid="' + uid + '"]');
			return el.length ? el : $('.user_postcount_' + uid); // deprecated after 0.7x		
		},
		'user/reputation': function(uid) {
			var el = $('[component="user/reputation"][data-uid="' + uid + '"]');
			return el.length ? el : $('.reputation[data-uid="' + uid + '"]'); // deprecated after 0.7x		
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
}());