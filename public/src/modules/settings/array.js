define(function () {
	var Settings, SettingsArray, addAddButton, addArrayChildElement, createRemoveButton, helper;
	Settings = null;
	helper = null;

	/**
    Creates a new button that removes itself and the given elements on click.
    Calls {@link Settings.helper.destructElement} for each given field.
    @param elements The elements to remove on click.
    @returns JQuery The created remove-button.
   */
	createRemoveButton = function (elements) {
		var rm;
		rm = $(helper.createElement('button', {
			"class": 'btn btn-xs btn-primary remove',
			title: 'Remove Item'
		}, '-'));
		return rm.click(function (event) {
			event.preventDefault();
			elements.remove();
			rm.remove();
			return elements.each(function (i, element) {
				element = $(element);
				if (element.is('[data-key]')) {
					return helper.destructElement(element);
				}
			});
		});
	};

	/**
    Creates a new child-element of given field with given data and calls given callback with elements to add.
    @param field Any wrapper that contains all fields of the array.
    @param key The key of the array.
    @param attributes The attributes to call {@link Settings.helper.createElementOfType} with or to add as
           element-attributes.
    @param value The value to call {@link Settings.helper.fillField} with.
    @param sep The separator to use.
    @param insertCb The callback to insert the elements.
   */
	addArrayChildElement = function (field, key, attributes, value, sep, insertCb) {
		var el, k, tagName, type, v;
		attributes = helper.deepClone(attributes);
		type = attributes['data-type'] || attributes.type || 'text';
		tagName = attributes.tagName;
		el = $(helper.createElementOfType(type, tagName, attributes)).attr('data-parent', '_' + key);
		delete attributes['data-type'];
		delete attributes.tagName;
		for (k in attributes) {
			v = attributes[k];
			if (k.search('data-') === 0) {
				el.data(k.substring(5), v);
			} else if (k.search('prop-') === 0) {
				el.prop(k.substring(5), v);
			} else {
				el.attr(k, v);
			}
		}
		helper.fillField(el, value);
		if ($("[data-parent=\"_" + key + "\"]", field).length) {
			insertCb(sep);
		}
		insertCb(el);
		return insertCb(createRemoveButton(el.add(sep)));
	};

	/**
    Adds a new button that adds a new child-element to given element on click.
    @param element The element to insert the button.
    @param key The key to forward to {@link addArrayChildElement}.
    @param attributes The attributes to forward to {@link addArrayChildElement}.
    @param sep The separator to forward to {@link addArrayChildElement}.
   */
	addAddButton = function (element, key, attributes, sep) {
		var add, addSpace, newValue;
		newValue = element.data('new');
		if (newValue == null) {
			newValue = '';
		}
		addSpace = $(document.createTextNode(' '));
		add = $(helper.createElement('button', {
			"class": 'btn btn-sm btn-primary add',
			title: 'Expand Array'
		}, '+'));
		add.click(function (event) {
			event.preventDefault();
			return addArrayChildElement(element, key, attributes, newValue, sep, function (el) {
				return addSpace.before(el);
			});
		});
		element.append(addSpace);
		return element.append(add);
	};
	SettingsArray = {
		types: ['array', 'div'],
		use: function () {
			return helper = (Settings = this).helper;
		},
		create: function (ignored, tagName) {
			return helper.createElement(tagName || 'div');
		},
		set: function (element, value) {
			var attributes, key, sep, val, _i, _len, _ref;
			key = element.data('key') || element.data('parent');
			sep = element.data('split') || ', ';
			sep = (function () {
				try {
					return $(sep);
				} catch (_error) {
					return $(document.createTextNode(sep));
				}
			})();
			if (typeof (attributes = element.data('attributes')) !== 'object') {
				attributes = {};
			}
			_ref = value || [];
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				val = _ref[_i];
				addArrayChildElement(element, key, attributes, val, sep, function (el) {
					return element.append(el);
				});
			}
			return addAddButton(element, key, attributes, sep);
		},
		get: function (element, trim, empty) {
			var children, key, values;
			key = element.data('key') || element.data('parent');
			children = $("[data-parent=\"_" + key + "\"]", element);
			values = [];
			children.each(function (i, child) {
				var val;
				child = $(child);
				val = helper.readValue(child);
				if ((val !== void 0 && (val != null ? val.length : void 0) !== 0) || helper.isTrue(child.data('empty'))) {
					return values.push(val);
				}
			});
			if (empty || values.length) {
				return values;
			} else {
				return void 0;
			}
		}
	};
	return SettingsArray;
});
