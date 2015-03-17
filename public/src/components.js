"use strict";

var components = components || {};

(function() {
	components.core = {
		'post/content': function(pid) {
			var el = $('[data-pid="' + pid + '"]').find('[component="post/content"]');
			return el.length ? el : $('#content_' + pid); // deprecated after 0.7x
		},
		'post/header': function(pid) {
			var el = $('[data-pid="' + pid + '"]').find('[component="post/header"]');
			return el.length ? el : $('#topic_title_' + pid); // deprecated after 0.7x	
		}
	};

	components.get = function() {
		var args = Array.prototype.slice.call(arguments, 1);
		return components.core[arguments[0]].apply(this, args);
	};
}());