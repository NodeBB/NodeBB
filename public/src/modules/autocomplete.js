
'use strict';

/* globals define, socket, app */

define('autocomplete', function() {
	var module = {};

	module.user = function (input, onselect) {
		app.loadJQueryUI(function() {
			input.autocomplete({
				delay: 200,
				open: function() {
					$(this).autocomplete('widget').css('z-index', 20000);
				},
				select: onselect,
				source: function(request, response) {
					socket.emit('user.search', {query: request.term}, function(err, result) {
						if (err) {
							return app.alertError(err.message);
						}

						if (result && result.users) {
							var names = result.users.map(function(user) {
								var username = $('<div/>').html(user.username).text()
								return user && {
									label: username,
									value: username,
									user: {
										uid: user.uid,
										name: user.username,
										slug: user.userslug
									}
								};
							});
							response(names);
						}
						$('.ui-autocomplete a').attr('data-ajaxify', 'false');
					});
				}
			});
		});
	};

	module.group = function(input, onselect) {
		app.loadJQueryUI(function() {
			input.autocomplete({
				delay: 200,
				select: onselect,
				source: function(request, response) {
					socket.emit('groups.search', {
						query: request.term
					}, function(err, results) {
						if (err) {
							return app.alertError(err.message);
						}

						if (results && results.length) {
							var names = results.map(function(group) {
								return group && {
									label: group.name,
									value: group.name,
									group: {
										name: group.name,
										slug: group.slug
									}
								};
							});
							response(names);
						}
						$('.ui-autocomplete a').attr('data-ajaxify', 'false');
					});
				}
			});
		});
	};

	return module;
});
