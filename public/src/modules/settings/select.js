define(function() {
  var Settings, SettingsSelect, addOptions;
  Settings = null;
  addOptions = function(element, options) {
    var optionData, val, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = options.length; _i < _len; _i++) {
      optionData = options[_i];
      val = optionData.text || optionData.value;
      delete optionData.text;
      _results.push(element.append($(Settings.helper.createElement('option', optionData)).text(val)));
    }
    return _results;
  };
  SettingsSelect = {
    types: ['select'],
    use: function() {
      return Settings = this;
    },
    create: function(ignore, ignored, data) {
      var el;
      el = $(Settings.helper.createElement('select'));
      addOptions(el, data['data-options']);
      delete data['data-options'];
      return el;
    },
    init: function(element) {
      var options;
      options = element.data('options');
      if (options != null) {
        return addOptions(element, options);
      }
    },
    set: function(element, value) {
      return element.val(value || '');
    },
    get: function(element, ignored, empty) {
      var val;
      val = element.val();
      if (empty || val) {
        return val;
      } else {
        return null;
      }
    }
  };
  return SettingsSelect;
});
