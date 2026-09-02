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
				position: getMenuPosition(),
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
							return user && {
								label: user.username,
								value: user.username,
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
				api.get('/groups', {
					query: request.term,
				}, function (err, result) {
					if (err) {
						return alerts.error(err);
					}
					if (result && result.groups.length) {
						const names = result.groups.map(function (group) {
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

	// jquery-ui defaults to anchoring the menu on the left edge of the input,
	// which is the wrong edge in rtl
	function getMenuPosition() {
		const edge = document.querySelector('html').getAttribute('data-dir') === 'rtl' ? 'right' : 'left';
		return {
			my: `${edge} top`,
			at: `${edge} bottom`,
			collision: 'none',
		};
	}

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
		let editor;
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

		const textcomplete = new Textcomplete(editor, strategies, {
			dropdown: options,
		});
		textcomplete.on('rendered', function () {
			if (textcomplete.dropdown.items.length) {
				// Activate the first item by default.
				textcomplete.dropdown.items[0].activate();
			}
		});

		const placement = (options && options.placement) || 'auto';

		textcomplete.dropdown.setOffset = function (cursorOffset) {
			const el = this.el;
			if (!el) {
				return this;
			}
			const rect = targetEl.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) {
				el.style.display = 'none';
				return this;
			}

			// Check if targetEl is visible in viewport
			if (rect.bottom < 0 || rect.top > window.innerHeight) {
				el.style.visibility = 'hidden';
				return this;
			}

			let clientX;
			let clientY;
			let cursorLineTop;
			const lineHeight = (cursorOffset && cursorOffset.lineHeight) || 20;

			if (typeof editor.getCursorPosition === 'function') {
				const cursorPosition = editor.getCursorPosition();
				const elScroll = typeof editor.getElScroll === 'function' ?
					editor.getElScroll() :
					{ top: targetEl.scrollTop, left: targetEl.scrollLeft };
				const caretY = rect.top + cursorPosition.top - elScroll.top;
				const caretX = rect.left + cursorPosition.left - elScroll.left;
				cursorLineTop = caretY;
				clientY = caretY + lineHeight;
				clientX = caretX;
			} else if (typeof editor.getRange === 'function') {
				try {
					const range = editor.getRange();
					const rangeRect = range.getBoundingClientRect();
					cursorLineTop = rangeRect.top;
					clientY = rangeRect.bottom;
					clientX = rangeRect.left;
				} catch (err) {
					cursorLineTop = (cursorOffset.top - window.pageYOffset) - lineHeight;
					clientY = cursorOffset.top - window.pageYOffset;
					clientX = cursorOffset.left !== undefined ? cursorOffset.left - window.pageXOffset : undefined;
				}
			} else {
				cursorLineTop = (cursorOffset.top - window.pageYOffset) - lineHeight;
				clientY = cursorOffset.top - window.pageYOffset;
				clientX = cursorOffset.left !== undefined ? cursorOffset.left - window.pageXOffset : undefined;
			}

			// Check if cursor is scrolled outside of targetEl visible area
			if (clientY < rect.top - 5 || cursorLineTop > rect.bottom + 5) {
				el.style.visibility = 'hidden';
				return this;
			}
			el.style.visibility = 'visible';

			const dropdownHeight = el.offsetHeight || 200;
			const dropdownWidth = el.offsetWidth || 250;

			let top = clientY;
			if (placement === 'top') {
				top = cursorLineTop - dropdownHeight;
				if (top < 10) {
					top = Math.max(10, clientY);
				}
			} else if (placement === 'bottom') {
				top = clientY;
				if (top + dropdownHeight > window.innerHeight - 10) {
					if (cursorLineTop - dropdownHeight >= 10) {
						top = cursorLineTop - dropdownHeight;
					} else {
						top = Math.max(10, window.innerHeight - dropdownHeight - 10);
					}
				}
			} else {
				// auto
				if (top + dropdownHeight > window.innerHeight - 10 && cursorLineTop - dropdownHeight >= 10) {
					top = cursorLineTop - dropdownHeight;
				} else if (top + dropdownHeight > window.innerHeight - 10) {
					top = Math.max(10, window.innerHeight - dropdownHeight - 10);
				}
			}

			const isRtl = targetEl.getAttribute('dir') === 'rtl' ||
				document.documentElement.getAttribute('data-dir') === 'rtl' ||
				document.body.getAttribute('data-dir') === 'rtl';

			let left = 'auto';
			let right = 'auto';

			if (isRtl) {
				let clientRight = document.documentElement.clientWidth - clientX;
				clientRight = Math.max(10, Math.min(clientRight, window.innerWidth - dropdownWidth - 10));
				right = `${clientRight}px`;
			} else {
				clientX = Math.max(10, Math.min(clientX, window.innerWidth - dropdownWidth - 10));
				left = `${clientX}px`;
			}

			Object.assign(el.style, {
				position: 'fixed',
				top: `${top}px`,
				bottom: 'auto',
				left: left,
				right: right,
				marginTop: '0px',
			});

			return this;
		};

		function onScroll() {
			if (!textcomplete.isShown()) {
				return;
			}
			textcomplete.dropdown.setOffset(editor.getCursorOffset());
		}

		window.addEventListener('scroll', onScroll, { passive: true, capture: true });

		let resizeObserver;
		if (window.ResizeObserver) {
			resizeObserver = new ResizeObserver(() => {
				if (textcomplete.isShown()) {
					textcomplete.dropdown.setOffset(editor.getCursorOffset());
				}
			});
			resizeObserver.observe(targetEl);
		}

		const origDestroy = textcomplete.destroy.bind(textcomplete);
		textcomplete.destroy = function (destroyEditor = true) {
			window.removeEventListener('scroll', onScroll, { capture: true });
			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}
			return origDestroy(destroyEditor);
		};

		return textcomplete;
	};


	return autocomplete;
});
