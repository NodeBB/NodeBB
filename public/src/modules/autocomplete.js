
'use strict';

define('autocomplete', function () {
	var module = {};
	var modelsStrategies = {
		user: [
			{
				id: 'user',
				search: function (term, callback) {
					socket.emit('user.search', { query: term, paginate: false }, function (err, response) {
						if (err) {
							return app.alertError(err.message);
						}
						var results = response.users.map(function (user) {
							var username = $('<div/>').html(user.username).text();
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
						callback(results.filter(function (result) { return !!result; }));
					});
				},
				match: /(.+)/,
				index: 1,
				replace: function (result) {
					return result.label;
				},
				template: function (result) {
					return result.label;
				},
			},
		],
		group: [
			{
				id: 'group',
				search: function (term, callback) {
					socket.emit('groups.search', { query: term }, function (err, response) {
						if (err) {
							return app.alertError(err.message);
						}
						var results = [];
						if (response && response.length) {
							results = response.map(function (group) {
								return group && {
									label: group.name,
									value: group.name,
									group: {
										name: group.name,
										slug: group.slug,
									},
								};
							});
						}
						callback(results.filter(function (result) { return !!result; }));
					});
				},
				match: /(.+)/,
				index: 1,
				replace: function (result) {
					return result.label;
				},
				template: function (result) {
					return result.label;
				},
			},
		],
		tag: [
			{
				search: function (term, callback) {
					socket.emit('topics.autocompleteTags', { query: term, cid: ajaxify.data.cid || 0 }, function (err, response) {
						if (err) {
							return app.alertError(err.message);
						}
						var results = [];
						if (response && response.length) {
							results = response;
						}
						callback(results.filter(function (result) { return !!result; }));
					});
				},
				match: /(.+)/,
				index: 1,
				replace: function (result) {
					return result;
				},
				template: function (result) {
					return result;
				},
			},
		],
	};

	module.setup = function (element, data) {
		var $element = $(element);
		element = $element.get(0);
		var model = data.model;
		var uuid = data.uuid;
		var onselect = data.onselect;

		if (!element || $element.data('autocomplete-uuid')) {
			return;
		}
		if (!uuid) {
			uuid = utils.generateUUID();
		}
		$element.data('autocomplete-uuid', uuid);

		var dropdownClass = 'autocomplete-dropdown-' + uuid;

		var textcompleteStrategies = []
			.concat(data.strategies || [])
			.concat(modelsStrategies[model] || [])
			.filter(function (s) { return !!s; });

		var textcompleteOptions = $.extend(true, {}, {
			dropdown: {
				placement: 'auto',
				style: {
					'z-index': 20000,
				},
				className: dropdownClass + ' dropdown-menu textcomplete-dropdown',
			},
		});

		var editor;
		if (element.nodeName === 'TEXTAREA' || element.nodeName === 'INPUT') {
			var Textarea = window.Textcomplete.editors.Textarea;
			editor = new Textarea(element);
		} else if (element.nodeName === 'DIV' && element.getAttribute('contenteditable') === 'true') {
			var ContentEditable = window.Textcomplete.editors.ContentEditable;
			editor = new ContentEditable(element);
		}

		// yuku-t/textcomplete inherits directionality from target element itself
		$element.attr('dir', document.querySelector('html').getAttribute('data-dir') || 'auto');

		var textcomplete = new window.Textcomplete(editor, textcompleteOptions);
		textcomplete.register(textcompleteStrategies);

		textcomplete.on('rendered', function () {
			if (textcomplete.dropdown.items.length) {
				// Activate the first item by default.
				textcomplete.dropdown.items[0].activate();
			}
		});

		textcomplete.on('select', function (e) {
			handleOnSelect($element, onselect, e, { item: e.detail.searchResult.data }, uuid);

			// https://github.com/yuku/textcomplete/issues/165
			setTimeout(function () { textcomplete.dropdown.hide(); }, 100);
		});

		return textcomplete;
	};

	module.user = function (input, onselect) {
		module.setup(input, { model: 'user', onselect: onselect });
	};

	module.group = function (input, onselect) {
		module.setup(input, { model: 'group', onselect: onselect });
	};

	module.tag = function (input, onselect) {
		module.setup(input, { model: 'tag', onselect: onselect });
	};

	function handleOnSelect(input, onselect, event, ui) {
		onselect = onselect || function () {};
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
