'use strict';

define('admin/modules/checkboxRowSelector', function () {
	const self = {};
	let $tableContainer;

	self.toggling = false;

	self.init = function (tableCssSelector) {
		$tableContainer = $(tableCssSelector);
		$tableContainer.on('change', 'input.checkbox-helper', handleChange);
	};

	self.updateAll = function () {
		$tableContainer.find('input.checkbox-helper').each((idx, el) => {
			self.updateState($(el));
		});
	};

	self.updateState = function ($checkboxEl) {
		if (self.toggling) {
			return;
		}
		const checkboxes = $checkboxEl.closest('tr').find('input:not([disabled])').toArray();
		const $toggler = $(checkboxes.shift());
		const rowState = checkboxes.every(el => el.checked);
		$toggler.prop('checked', rowState);
	};

	function handleChange(ev) {
		const $checkboxEl = $(ev.target);
		toggleAll($checkboxEl);
	}

	function toggleAll($checkboxEl) {
		self.toggling = true;
		const state = $checkboxEl.prop('checked');
		$checkboxEl.closest('tr').find('input:not(.checkbox-helper)').each((idx, el) => {
			const $checkbox = $(el);
			if ($checkbox.prop('checked') === state) {
				return;
			}
			$checkbox.click();
		});
		self.toggling = false;
	}

	return self;
});
