define(function() {
  var Settings, SettingsArray, addArrayChildElement, createRemoveButton, helper;
  Settings = null;
  helper = null;
  createRemoveButton = function(separator, element) {
    var rm;
    rm = $(helper.createElement('button', {
      "class": 'btn btn-xs btn-primary remove',
      title: 'Remove Item'
    }, '-'));
    return rm.click(function(e) {
      e.preventDefault();
      separator.remove();
      rm.remove();
      element.remove();
      return helper.destructElement(element);
    });
  };
  addArrayChildElement = function(field, key, attributes, value, sep, insertCb) {
    var el, k, tagName, type, v;
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
    try {
      sep = $(sep);
    } catch (_error) {
      sep = document.createTextNode(sep);
    }
    if ($("[data-parent=\"_" + key + "\"]", field).length) {
      insertCb(sep);
    }
    insertCb(el);
    return insertCb(createRemoveButton(sep, el));
  };
  SettingsArray = {
    types: ['array', 'div'],
    use: function() {
      return helper = (Settings = this).helper;
    },
    create: function(ignored, tagName) {
      return helper.createElement(tagName || 'div');
    },
    set: function(element, value) {
      var add, addSpace, attributes, key, newValue, sep, val, _i, _len, _ref;
      key = element.data('key') || element.data('parent');
      sep = element.data('split') || ', ';
      newValue = element.data('new');
      if (newValue == null) {
        newValue = '';
      }
      attributes = element.data('attributes');
      if (typeof attributes !== 'object') {
        attributes = {};
      }
      _ref = value || [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        val = _ref[_i];
        addArrayChildElement(element, key, helper.deepClone(attributes), val, sep, function(el) {
          return element.append(el);
        });
      }
      addSpace = $(document.createTextNode(' '));
      add = $(helper.createElement('button', {
        "class": 'btn btn-sm btn-primary add',
        title: 'Expand Array'
      }, '+'));
      add.click(function(event) {
        event.preventDefault();
        return addArrayChildElement(element, key, helper.deepClone(attributes), newValue, sep, function(el) {
          return addSpace.before(el);
        });
      });
      element.append(addSpace);
      return element.append(add);
    },
    get: function(element, trim, empty) {
      var child, children, key, value, values, _i, _len, _ref;
      key = element.data('key') || element.data('parent');
      children = $("[data-parent=\"_" + key + "\"]", element);
      values = [];
      _ref = children.toArray();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        child = $(child);
        value = helper.readValue(child);
        if (((value != null) && value.length !== 0) || helper.isTrue(child.data('empty'))) {
          values.push(value);
        }
      }
      if (empty || values.length) {
        return values;
      } else {
        return null;
      }
    }
  };
  return SettingsArray;
});
