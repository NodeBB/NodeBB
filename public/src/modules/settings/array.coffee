define ->

  Settings = null
  helper = null

  ###*
    Creates a new button that removes itself and the given elements on click.
    Calls {@link Settings.helper.destructElement} for each given field.
    @param elements The elements to remove on click.
    @returns JQuery The created remove-button.
  ###
  createRemoveButton = (elements) ->
    rm = $ helper.createElement 'button',
      class: 'btn btn-xs btn-primary remove'
      title: 'Remove Item'
    , '-'
    rm.click (event) ->
      event.preventDefault()
      elements.remove()
      rm.remove()
      elements.each (i, element) ->
        element = $ element
        if element.is '[data-key]'
          helper.destructElement element

  ###*
    Creates a new child-element of given field with given data and calls given callback with elements to add.
    @param field Any wrapper that contains all fields of the array.
    @param key The key of the array.
    @param attributes The attributes to call {@link Settings.helper.createElementOfType} with or to add as
           element-attributes.
    @param value The value to call {@link Settings.helper.fillField} with.
    @param sep The separator to use.
    @param insertCb The callback to insert the elements.
  ###
  addArrayChildElement = (field, key, attributes, value, sep, insertCb) ->
    attributes = helper.deepClone attributes
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
    insertCb sep if $("[data-parent=\"_#{key}\"]", field).length
    insertCb el
    insertCb createRemoveButton el.add sep

  ###*
    Adds a new button that adds a new child-element to given element on click.
    @param element The element to insert the button.
    @param key The key to forward to {@link addArrayChildElement}.
    @param attributes The attributes to forward to {@link addArrayChildElement}.
    @param sep The separator to forward to {@link addArrayChildElement}.
  ###
  addAddButton = (element, key, attributes, sep) ->
    newValue = element.data 'new'
    newValue = '' if !newValue?
    addSpace = $ document.createTextNode ' '
    add = $ helper.createElement 'button',
      class: 'btn btn-sm btn-primary add'
      title: 'Expand Array'
    , '+'
    add.click (event) ->
      event.preventDefault()
      addArrayChildElement element, key, attributes, newValue, sep, (el) -> addSpace.before el
    element.append addSpace
    element.append add

  SettingsArray =
    types: ['array', 'div']
    use: -> helper = (Settings = this).helper
    create: (ignored, tagName) -> helper.createElement tagName || 'div'
    set: (element, value) ->
      key = element.data('key') || element.data 'parent'
      sep = element.data('split') || ', '
      sep = try $ sep
      catch
        $ document.createTextNode sep
      attributes = {} if typeof (attributes = element.data 'attributes') != 'object'
      for val in value || []
        addArrayChildElement element, key, attributes, val, sep, (el) -> element.append el
      addAddButton element, key, attributes, sep
    get: (element, trim, empty) ->
      key = element.data('key') || element.data 'parent'
      children = $ "[data-parent=\"_#{key}\"]", element
      values = []
      children.each (i, child) ->
        child = $ child
        val = helper.readValue child
        values.push val if (val != undefined && val?.length != 0) || helper.isTrue child.data 'empty'
      if empty || values.length then values else undefined

  SettingsArray