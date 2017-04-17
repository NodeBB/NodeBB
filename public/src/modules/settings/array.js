'use strict';

define('settings/array', function () {
	var SettingsArray;
	var helper = null;

	/**
	 Creates a new button that removes itself and the given elements on click.
	 Calls {@link Settings.helper.destructElement} for each given field.
	 @param elements The elements to remove on click.
	 @returns JQuery The created remove-button.
	 */
	function createRemoveButton(elements) {
		var rm = $(helper.createElement('button', {
			class: 'btn btn-xs btn-primary remove',
			title: 'Remove Item',
		}, '-'));
		rm.click(function (event) {
			event.preventDefault();
			elements.remove();
			rm.remove();
			elements.each(function (i, element) {
				element = $(element);
				if (element.is('[data-key]')) {
					helper.destructElement(element);
				}
			});
		});
		return rm;
	}

	/**
	 Creates a new child-element of given field with given data and calls given callback with elements to add.
	 @param field Any wrapper that contains all fields of the array.
	 @param key The key of the array.
	 @param attributes The attributes to call {@link Settings.helper.createElementOfType} with or to add as
	 element-attributes.
	 @param value The value to call {@link Settings.helper.fillField} with.
	 @param separator The separator to use.
	 @param insertCb The callback to insert the elements.
	 */
	function addArrayChildElement(field, key, attributes, value, separator, insertCb) {
		attributes = helper.deepClone(attributes);
		var type = attributes['data-type'] || attributes.type || 'text';
		var element = $(helper.createElementOfType(type, attributes.tagName, attributes));
		element.attr('data-parent', '_' + key);
		delete attributes['data-type'];
		delete attributes.tagName;
		for (var name in attributes) {
			if (attributes.hasOwnProperty(name)) {
				var val = attributes[name];
				if (name.search('data-') === 0) {
					element.data(name.substring(5), val);
				} else if (name.search('prop-') === 0) {
					element.prop(name.substring(5), val);
				} else {
					element.attr(name, val);
				}
			}
		}
		helper.fillField(element, value);
		if ($('[data-parent="_' + key + '"]', field).length) {
			insertCb(separator);
		}
		insertCb(element);
		insertCb(createRemoveButton(element.add(separator)));
	}

	/**
	 Adds a new button that adds a new child-element to given element on click.
	 @param element The element to insert the button.
	 @param key The key to forward to {@link addArrayChildElement}.
	 @param attributes The attributes to forward to {@link addArrayChildElement}.
	 @param separator The separator to forward to {@link addArrayChildElement}.
	 */
	function addAddButton(element, key, attributes, separator) {
		var addSpace = $(document.createTextNode(' '));
		var newValue = element.data('new') || '';
		var add = $(helper.createElement('button', {
			class: 'btn btn-sm btn-primary add',
			title: 'Expand Array',
		}, '+'));
		add.click(function (event) {
			event.preventDefault();
			addArrayChildElement(element, key, attributes, newValue, separator.clone(), function (el) {
				addSpace.before(el);
			});
		});
		element.append(addSpace);
		element.append(add);
	}


	SettingsArray = {
		types: ['array', 'div'],
		use: function () {
			helper = this.helper;
		},
		create: function (ignored, tagName) {
			return helper.createElement(tagName || 'div');
		},
		set: function (element, value) {
			var attributes = element.data('attributes');
			var key = element.data('key') || element.data('parent');
			var separator = element.data('split') || ', ';
			separator = (function () {
				try {
					return $(separator);
				} catch (_error) {
					return $(document.createTextNode(separator));
				}
			}());
			if (typeof attributes !== 'object') {
				attributes = {};
			}
			element.empty();
			if (!(value instanceof Array)) {
				value = [];
			}
			for (var i = 0; i < value.length; i += 1) {
				addArrayChildElement(element, key, attributes, value[i], separator.clone(), function (el) {
					element.append(el);
				});
			}
			addAddButton(element, key, attributes, separator);
		},
		get: function (element, trim, empty) {
			var key = element.data('key') || element.data('parent');
			var children = $('[data-parent="_' + key + '"]', element);
			var values = [];
			children.each(function (i, child) {
				child = $(child);
				var val = helper.readValue(child);
				var empty = helper.isTrue(child.data('empty'));
				if (empty || (val !== undefined && (val == null || val.length !== 0))) {
					return values.push(val);
				}
			});
			if (empty || values.length) {
				return values;
			}
		},
	};

	return SettingsArray;
});
