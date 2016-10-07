define('settings/number', function() {
  return {
    types: ['number'],
    get: function(element, trim, empty) {
      var value = element.val();
      if (!empty) {
        return value ? Number(value) : void 0;
      }
      return value ? Number(value) : 0;
    }
  };
});
