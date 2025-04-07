'use strict';

const translator = require('./modules/translator');

window.overrides = window.overrides || {};

function translate(elements, type, str) {
	return elements.each(function () {
		const el = $(this);
		translator.translate(str, function (translated) {
			el[type](translated);
		});
	});
}

if (typeof window !== 'undefined') {
	(function ($) {
		$.fn.getCursorPosition = function () {
			const el = $(this).get(0);
			let pos = 0;
			if ('selectionStart' in el) {
				pos = el.selectionStart;
			} else if ('selection' in document) {
				el.focus();
				const Sel = document.selection.createRange();
				const SelLength = document.selection.createRange().text.length;
				Sel.moveStart('character', -el.value.length);
				pos = Sel.text.length - SelLength;
			}
			return pos;
		};

		$.fn.selectRange = function (start, end) {
			if (!end) {
				end = start;
			}
			return this.each(function () {
				if (this.setSelectionRange) {
					this.focus();
					this.setSelectionRange(start, end);
				} else if (this.createTextRange) {
					const range = this.createTextRange();
					range.collapse(true);
					range.moveEnd('character', end);
					range.moveStart('character', start);
					range.select();
				}
			});
		};

		// http://stackoverflow.com/questions/511088/use-javascript-to-place-cursor-at-end-of-text-in-text-input-element
		$.fn.putCursorAtEnd = function () {
			return this.each(function () {
				$(this).focus();

				if (this.setSelectionRange) {
					const len = $(this).val().length * 2;
					this.setSelectionRange(len, len);
				} else {
					$(this).val($(this).val());
				}
				this.scrollTop = 999999;
			});
		};

		$.fn.translateHtml = function (str) {
			return translate(this, 'html', str);
		};

		$.fn.translateText = function (str) {
			return translate(this, 'text', str);
		};

		$.fn.translateVal = function (str) {
			return translate(this, 'val', str);
		};

		$.fn.translateAttr = function (attr, str) {
			return this.each(function () {
				const el = $(this);
				translator.translate(str, function (translated) {
					el.attr(attr, translated);
				});
			});
		};
	}(jQuery || { fn: {} }));

	let timeagoFn;
	overrides.overrideTimeagoCutoff = function () {
		const cutoff = parseInt(ajaxify.data.timeagoCutoff || config.timeagoCutoff, 10);
		if (cutoff === 0) {
			$.timeago.settings.cutoff = 1;
		} else if (cutoff > 0) {
			$.timeago.settings.cutoff = 1000 * 60 * 60 * 24 * cutoff;
		}
	};

	overrides.overrideTimeago = function () {
		if (!timeagoFn) {
			timeagoFn = $.fn.timeago;
		}

		overrides.overrideTimeagoCutoff();

		$.timeago.settings.allowFuture = true;
		const userLang = config.userLang.replace('_', '-');
		const options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };
		let formatFn = function (date) {
			return date.toLocaleString(userLang, options);
		};
		try {
			if (typeof Intl !== 'undefined') {
				const dtFormat = new Intl.DateTimeFormat(userLang, options);
				formatFn = dtFormat.format;
			}
		} catch (err) {
			console.error(err);
		}

		let iso;
		let date;
		$.fn.timeago = function () {
			const els = $(this);
			// Convert "old" format to new format (#5108)
			els.each(function () {
				iso = this.getAttribute('title');
				if (!iso) {
					return;
				}
				this.setAttribute('datetime', iso);
				date = new Date(iso);
				if (!isNaN(date)) {
					this.textContent = formatFn(date);
				}
			});

			timeagoFn.apply(this, arguments);
		};
	};
}
