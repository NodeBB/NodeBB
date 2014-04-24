define(function() {
  var Settings, SettingsCheckbox;
  Settings = null;
  SettingsCheckbox = {
    types: ['checkbox'],
    use: function() {
      return Settings = this;
    },
    create: function() {
      return Settings.helper.createElement('input', {
        type: 'checkbox'
      });
    },
    set: function(element, value) {
      return element.prop('checked', value);
    },
    get: function(element, trim, empty) {
      var value;
      value = element.prop('checked');
      value = trim ? (value ? 1 : 0) : value;
      if (empty) {
        return value || null;
      } else {
        return value;
      }
    }
  };
  return SettingsCheckbox;
});
