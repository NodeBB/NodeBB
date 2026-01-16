'use strict';

define('autocomplete', [
	'api', 'alerts', '@textcomplete/core', '@textcomplete/textarea', '@textcomplete/contenteditable',
], function (api, alerts, { Textcomplete }, { TextareaEditor }, { ContenteditableEditor }) {
	const autocomplete = {};
	const _default = {
		delay: 200,
		appendTo: null,
	};

	autocomplete.init = (params) => {
		const acParams = { ..._default, ...params };
		const { input, onSelect } = acParams;
		app.loadJQueryUI(function () {
			input.autocomplete({
				...acParams,
				open: function () {
					$(this).autocomplete('widget').css('z-index', 100005);
				},
				select: function (event, ui) {
					handleOnSelect(input, onSelect, event, ui);
				},
			});
		});
	};

	autocomplete.user = function (input, params, onSelect) {
		if (typeof params === 'function') {
			onSelect = params;
			params = {};
		}
		params = params || {};

		autocomplete.init({
			input,
			onSelect,
			source: (request, response) => {
				params.query = request.term;

				api.get('/api/users', params, function (err, result) {
					if (err) {
						return alerts.error(err);
					}

					if (result && result.users) {
						const names = result.users.map(function (user) {
							const username = $('<div></div>').html(user.username).text();
							return user && {
								label: username,
								value: username,
								user: {
									uid: user.uid,
									name: user.username,
									slug: user.userslug,
									username: user.username,
									userslug: user.userslug,
									displayname: user.displayname,
									picture: user.picture,
									banned: user.banned,
									'icon:text': user['icon:text'],
									'icon:bgColor': user['icon:bgColor'],
								},
							};
						});
						response(names);
					}

					$('.ui-autocomplete a').attr('data-ajaxify', 'false');
				});
			},
		});
	};

	autocomplete.group = function (input, onSelect) {
		autocomplete.init({
			input,
			onSelect,
			source: (request, response) => {
				socket.emit('groups.search', {
					query: request.term,
				}, function (err, results) {
					if (err) {
						return alerts.error(err);
					}
					if (results && results.length) {
						const names = results.map(function (group) {
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
	};

	autocomplete.tag = function (input, onSelect) {
		autocomplete.init({
			input,
			onSelect,
			delay: 100,
			source: (request, response) => {
				socket.emit('topics.autocompleteTags', {
					query: request.term,
					cid: ajaxify.data.cid || 0,
				}, function (err, tags) {
					if (err) {
						return alerts.error(err);
					}
					if (tags) {
						response(tags);
					}
					$('.ui-autocomplete a').attr('data-ajaxify', 'false');
				});
			},
		});
	};

	function handleOnSelect(input, onselect, event, ui) {
		onselect = onselect || function () { };
		const e = jQuery.Event('keypress');
		e.which = 13;
		e.keyCode = 13;
		setTimeout(function () {
			input.trigger(e);
		}, 100);
		onselect(event, ui);
	}

	// This is a generic method that is also used by the chat
	autocomplete.setup = function ({ element, strategies, options }) {
		const targetEl = element.get(0);
		if (!targetEl) {
			return;
		}
		var editor;
		if (targetEl.nodeName === 'TEXTAREA' || targetEl.nodeName === 'INPUT') {
			editor = new TextareaEditor(targetEl);
		} else if (targetEl.nodeName === 'DIV' && targetEl.getAttribute('contenteditable') === 'true') {
			editor = new ContenteditableEditor(targetEl);
		}
		if (!editor) {
			throw new Error('unknown target element type');
		}
		// yuku-t/textcomplete inherits directionality from target element itself
		targetEl.setAttribute('dir', document.querySelector('html').getAttribute('data-dir'));

		var textcomplete = new Textcomplete(editor, strategies, {
			dropdown: options,
		});
		textcomplete.on('rendered', function () {
			if (textcomplete.dropdown.items.length) {
				// Activate the first item by default.
				textcomplete.dropdown.items[0].activate();
			}
		});

		return textcomplete;
	};


	return autocomplete;
});
