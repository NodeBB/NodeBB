
'use strict';

/* globals define, socket, app */

define('autocomplete', function() {
	var module = {};

	module.user = function (input) {
		return input.autocomplete({
			delay: 100,
			source: function(request, response) {
				socket.emit('user.search', {query: request.term}, function(err, result) {
					if (err) {
						return app.alertError(err.message);
					}

					if (result && result.users) {
						var names = result.users.map(function(user) {
							return user && {
								label: user.username,
								value: user.username,
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
	};

	module.group = function(input) {
		return input.autocomplete({
			delay: 100,
			source: function(request, response) {
				socket.emit('groups.search', {
					query: request.term,
					options: {}
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
	};

	return module;
});
