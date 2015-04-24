define('settings/object', function () {

	var Settings = null,
		SettingsObject,
		helper = null;

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
		var prepend = attributes['data-prepend'],
			append = attributes['data-append'],
			type, element;
		delete attributes['data-prepend'];
		delete attributes['data-append'];
		attributes = helper.deepClone(attributes);
		type = attributes['data-type'] || attributes.type || 'text',
		element = $(helper.createElementOfType(type, attributes.tagName, attributes));
		element.attr('data-parent', '_' + key);
		element.attr('data-prop', prop);
		delete attributes['data-type'];
		delete attributes['tagName'];
		for (var name in attributes) {
			var val = attributes[name];
			if (name.search('data-') === 0) {
				element.data(name.substring(5), val);
			} else if (name.search('prop-') === 0) {
				element.prop(name.substring(5), val);
			} else {
				element.attr(name, val);
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
			helper = (Settings = this).helper;
		},
		create: function (ignored, tagName) {
			return helper.createElement(tagName || 'div');
		},
		set: function (element, value) {
			var properties = element.data('attributes') || element.data('properties'),
				key = element.data('key') || element.data('parent'),
				separator = element.data('split') || ', ',
				propertyIndex, propertyName, attributes;
			separator = (function () {
				try {
					return $(separator);
				} catch (_error) {
					return $(document.createTextNode(separator));
				}
			})();
			element.empty();
			if (typeof value !== 'object') {
				value = {};
			}
			if (Array.isArray(properties)) {
				for (propertyIndex in properties) {
					attributes = properties[propertyIndex];
					if (typeof attributes !== 'object') {
						attributes = {};
					}
					propertyName = attributes['data-prop'] || attributes['data-property'] || propertyIndex;
					if (value[propertyName] === void 0 && attributes['data-new'] !== void 0) {
						value[propertyName] = attributes['data-new'];
					}
					addObjectPropertyElement(element, key, attributes, propertyName, value[propertyName], separator.clone(), function (el) {
						element.append(el);
					});
				}
			}
		},
		get: function (element, trim, empty) {
			var key = element.data('key') || element.data('parent'),
				properties = $('[data-parent="_' + key + '"]', element),
				value = {};
			properties.each(function (i, property) {
				property = $(property);
				var val = helper.readValue(property),
					prop = property.data('prop'),
					empty = helper.isTrue(property.data('empty'));
				if (empty || val !== void 0 && (val == null || val.length !== 0)) {
					return value[prop] = val;
				}
			});
			if (empty || Object.keys(value).length) {
				return value;
			} else {
				return void 0;
			}
		}
	};

	return SettingsObject;

});
