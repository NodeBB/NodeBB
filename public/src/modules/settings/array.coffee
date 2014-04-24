define ->

  Settings = null
  helper = null

  createRemoveButton = (separator, element) ->
    rm = $ helper.createElement 'button',
      class: 'btn btn-xs btn-primary remove'
      title: 'Remove Item'
    , '-'
    rm.click (e) ->
      e.preventDefault()
      separator.remove()
      rm.remove()
      element.remove()
      helper.destructElement element

  addArrayChildElement = (field, key, attributes, value, sep, insertCb) ->
    type = attributes['data-type'] || attributes.type || 'text'
    tagName = attributes.tagName
    el = $(helper.createElementOfType type, tagName, attributes).attr 'data-parent', '_' + key
    delete attributes['data-type']
    delete attributes.tagName
    for k, v of attributes
      if k.search('data-') == 0
        el.data k.substring(5), v
      else if k.search('prop-') == 0
        el.prop k.substring(5), v
      else
        el.attr k, v
    helper.fillField el, value
    try
      sep = $ sep
    catch
      sep = document.createTextNode sep
    insertCb sep if $("[data-parent=\"_#{key}\"]", field).length
    insertCb el
    insertCb createRemoveButton sep, el

  SettingsArray =
    types: ['array', 'div']
    use: -> helper = (Settings = this).helper
    create: (ignored, tagName) -> helper.createElement tagName || 'div'
    set: (element, value) ->
      key = element.data('key') || element.data 'parent'
      sep = element.data('split') || ', '
      newValue = element.data 'new'
      newValue = '' if !newValue?
      attributes = element.data 'attributes'
      attributes = {} if typeof attributes != 'object'
      for val in value || []
        addArrayChildElement element, key, helper.deepClone(attributes), val, sep, (el) -> element.append el
      addSpace = $ document.createTextNode ' '
      add = $ helper.createElement 'button',
        class: 'btn btn-sm btn-primary add'
        title: 'Expand Array'
      , '+'
      add.click (event) ->
        event.preventDefault()
        addArrayChildElement element, key, helper.deepClone(attributes), newValue, sep, (el) -> addSpace.before el
      element.append addSpace
      element.append add
    get: (element, trim, empty) ->
      key = element.data('key') || element.data 'parent'
      children = $ "[data-parent=\"_#{key}\"]", element
      values = []
      for child in children.toArray()
        child = $ child
        value = helper.readValue child
        values.push value if (value? && value.length != 0) || helper.isTrue child.data 'empty'
      if empty || values.length then values else null

  SettingsArray