'use strict';

define('settings/object', function () {
	var SettingsObject;
	var helper = null;

	/**
	 Creates a new child-element of given property with given data and calls given callback with elements to add.
	 @param field Any wrapper that contains all properties of the object.
	 @param key The key of the object.
	 @param attributes The attributes to call {@link Settings.helper.createElementOfType} with or to add as
	 element-attributes.
	 @param value The value to call {@link Settings.helper.fillField} with.
	 @param separator The separator to use.
	 @param insertCb The callback to insert the elements.
	 */
	function addObjectPropertyElement(field, key, attributes, prop, value, separator, insertCb) {
		var prepend = attributes['data-prepend'];
		var append = attributes['data-append'];
		var type;
		var element;
		delete attributes['data-prepend'];
		delete attributes['data-append'];
		attributes = helper.deepClone(attributes);
		type = attributes['data-type'] || attributes.type || 'text';
		element = $(helper.createElementOfType(type, attributes.tagName, attributes));
		element.attr('data-parent', '_' + key);
		element.attr('data-prop', prop);
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
		if (prepend) {
			insertCb(prepend);
		}
		insertCb(element);
		if (append) {
			insertCb(append);
		}
	}

	SettingsObject = {
		types: ['object'],
		use: function () {
			helper = this.helper;
		},
		create: function (ignored, tagName) {
			return helper.createElement(tagName || 'div');
		},
		set: function (element, value) {
			var properties = element.data('attributes') || element.data('properties');
			var key = element.data('key') || element.data('parent');
			var separator = element.data('split') || ', ';
			var propertyIndex;
			var propertyName;
			var attributes;
			separator = (function () {
				try {
					return $(separator);
				} catch (_error) {
					return $(document.createTextNode(separator));
				}
			}());
			element.empty();
			if (typeof value !== 'object') {
				value = {};
			}
			if (Array.isArray(properties)) {
				for (propertyIndex in properties) {
					if (properties.hasOwnProperty(propertyIndex)) {
						attributes = properties[propertyIndex];
						if (typeof attributes !== 'object') {
							attributes = {};
						}
						propertyName = attributes['data-prop'] || attributes['data-property'] || propertyIndex;
						if (value[propertyName] === undefined && attributes['data-new'] !== undefined) {
							value[propertyName] = attributes['data-new'];
						}
						addObjectPropertyElement(element, key, attributes, propertyName, value[propertyName], separator.clone(), function (el) {
							element.append(el);
						});
					}
				}
			}
		},
		get: function (element, trim, empty) {
			var key = element.data('key') || element.data('parent');
			var properties = $('[data-parent="_' + key + '"]', element);
			var value = {};
			properties.each(function (i, property) {
				property = $(property);
				var val = helper.readValue(property);
				var prop = property.data('prop');
				var empty = helper.isTrue(property.data('empty'));
				if (empty || (val !== undefined && (val == null || val.length !== 0))) {
					value[prop] = val;
					return val;
				}
			});
			if (empty || Object.keys(value).length) {
				return value;
			}
		},
	};

	return SettingsObject;
});
