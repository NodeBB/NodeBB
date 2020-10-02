
'use strict';


define('autocomplete', function () {
	var module = {};

	module.user = function (input, params, onselect) {
		if (typeof params === 'function') {
			onselect = params;
			params = {};
		}

		app.loadJQueryUI(function () {
			input.autocomplete({
				delay: 200,
				open: function () {
					$(this).autocomplete('widget').css('z-index', 100005);
				},
				select: function (event, ui) {
					handleOnSelect(input, onselect, event, ui);
				},
				source: function (request, response) {
					params.query = params.query || request.term;
					params.paginate = params.paginate || false;

					socket.emit('user.search', params, function (err, result) {
						if (err) {
							return app.alertError(err.message);
						}

						if (result && result.users) {
							var names = result.users.map(function (user) {
								var username = $('<div></div>').html(user.username).text();
								return user && {
									label: username,
									value: username,
									user: {
										uid: user.uid,
										name: user.username,
										slug: user.userslug,
										username: user.username,
										userslug: user.userslug,
										picture: user.picture,
										'icon:text': user['icon:text'],
										'icon:bgColor': user['icon:bgColor'],
									},
								};
							});
							response(names);
						}

						$('.ui-autocomplete a').attr('data-ajaxify', 'false');
						delete params.query;
						delete params.paginate;
					});
				},
			});
		});
	};

	module.group = function (input, onselect) {
		app.loadJQueryUI(function () {
			input.autocomplete({
				delay: 200,
				open: function () {
					$(this).autocomplete('widget').css('z-index', 100005);
				},
				select: function (event, ui) {
					handleOnSelect(input, onselect, event, ui);
				},
				source: function (request, response) {
					socket.emit('groups.search', {
						query: request.term,
					}, function (err, results) {
						if (err) {
							return app.alertError(err.message);
						}
						if (results && results.length) {
							var names = results.map(function (group) {
								return group && {
									label: group.name,
									value: group.name,
									group: group,
								};
							});
							response(names);
						}
						$('.ui-autocomplete a').attr('data-ajaxify', 'false');
					});
				},
			});
		});
	};

	module.tag = function (input, onselect) {
		app.loadJQueryUI(function () {
			input.autocomplete({
				delay: 100,
				open: function () {
					$(this).autocomplete('widget').css('z-index', 20000);
				},
				select: function (event, ui) {
					handleOnSelect(input, onselect, event, ui);
				},
				source: function (request, response) {
					socket.emit('topics.autocompleteTags', {
						query: request.term,
						cid: ajaxify.data.cid || 0,
					}, function (err, tags) {
						if (err) {
							return app.alertError(err.message);
						}
						if (tags) {
							response(tags);
						}
						$('.ui-autocomplete a').attr('data-ajaxify', 'false');
					});
				},
			});
		});
	};

	function handleOnSelect(input, onselect, event, ui) {
		onselect = onselect || function () { };
		var e = jQuery.Event('keypress');
		e.which = 13;
		e.keyCode = 13;
		setTimeout(function () {
			input.trigger(e);
		}, 100);
		onselect(event, ui);
	}

	return module;
});
