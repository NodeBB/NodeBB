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
		attributes = helper.deepClone(attributes);
		var type = attributes['data-type'] || attributes.type || 'text',
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
		insertCb(element);
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
				attributes = {},
				key = element.data('key') || element.data('parent'),
				prop,
				separator = element.data('split') || ', ';
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
			if (typeof properties === 'object') {
				for (prop in properties) {
					attributes = properties[prop];
					if (typeof attributes !== 'object') {
						attributes = {};
					}
					addObjectPropertyElement(element, key, attributes, prop, value[prop], separator.clone(), function (el) {
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
