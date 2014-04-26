define ->

  defaultPlugins = [
    'settings/checkbox'
    'settings/textarea'
    'settings/select'
    'settings/array'
    'settings/key'
  ]

  ###
   # Attributes of HTML-tags that get used by default plugins:
   #   + data-key:   the key to save/load the value within configuration-object
   #   + data-type:  highest priority type-definition to determine what kind of element it is or which plugin to hook
   #   + type:       normal priority type-definition
   #   + data-empty: if 'false' or '0' then values that are assumed as empty turn into null. data-empty of arrays affect
   #                 their child-elements
   #   + data-trim:  if not 'false' or '0' then values will get trimmed as defined by the elements type
   #   + data-split: if set and the element doesn't belong to any plugin, it's value will get split and joined by its
   #                 value into the input-field
   #   array-elements:
   #     + data-split:      separator (HTML allowed) between the elements, defaults to ', '
   #     + data-new:        value to insert into new created elements
   #     + data-attributes: an object to set the attributes of the child HTML-elements. tagName as special key will set
   #                        the tag-name of the child HTML-elements
   #   key-fields:
   #     + data-trim:  if 'false' or '0' then the value will get saved as string else as object providing following
   #                   properties: ctrl, alt, shift, meta, code, char
   #     + data-split: separator between different modifiers and the key-code of the value that gets saved
   #                   (only takes effect if trimming)
   #     + data-short: if not 'false' or '0' then modifier-keys get saved as first uppercase character
   #                   (only takes effect if trimming)
   #   select:
   #     + data-options: an array of {"text":"Displayed Text","value":"some_value"}-like objects
   #
   # The name of the HTML-tag is lowest priority type-definition
   #
   # Examples-HTML:
       No!
       <input type="checkbox" data-key="cfg1"></input><br>
       Yes!
       <input type="checkbox" data-key="cfg2"></input><br>
       An array of checkboxes that are selected by default:
       <div data-key="cfg3" data-attributes='{"data-type":"checkbox"}' data-new='true'></div><br>
       A simple input-field of any common type:
       <input type="password" data-key="cfg4"></input><br>
       A simple textarea:
       <textarea data-key="cfg5"></textarea><br>
       Array of textareas:
       <div data-key="cfg6" data-attributes='{"data-type":"textarea"}' data-new='Hello Kitty, ahem... World!'></div><br>
       2D-Array of numbers that persist even when empty (but not empty rows):
       <div data-key="cfg7" data-split="<br>" data-attributes='{"data-type":"array","data-attributes":{"type":"number"}}' data-new='[42,21]'></div><br>
       Same with persisting empty rows, but not empty numbers, if no row is given null will get saved:
       <div data-key="cfg8" data-split="<br>" data-empty="false" data-attributes='{"data-type":"array","data-empty":true,"data-attributes":{"type":"number","data-empty":false}}' data-new='[42,21]'></div><br>
       Array of Key-shortcuts (new: Ctrl+Shift+7):
       <div data-key="cfg9" data-attributes='{"data-type":"key"}' data-new='Ctrl+Shift+#55'></div><br>
       Array of numbers (new: 42, step: 21):
       <div data-key="cfg10" data-attributes='{"data-type":"number","step":21}' data-new='42'></div><br>
       Select with dynamic options:
       <select data-key="cfg11" data-options='[{"value":"2","text":"2"},{"value":"3","text":"3"}]'></select><br>
       Select that loads faster:
       <select data-key="cfg12"><br>
         <option value="2">2</option>
         <option value="3">3</option>
       </select>
   #
   # Matching configuration:
       {
         cfg1: false,
         cfg2: true,
         cfg3: [false, false, true],
         cfg4: 'hello world',
         cfg5: 'some\nlong\ntext',
         cfg6: ['some\nlong\ntexts', 'and another one'],
         cfg7: [[]],
         cfg8: [[]],
         cfg9: [],
         cfg10: [],
         cfg11: 3,
         cfg12: 2
       }
  ###

  ###*
    Returns the hook of given name that matches the given type or element.
    @param type The type of the element to get the matching hook for, or the element itself.
    @param name The name of the hook.
  ###
  getHook = (type, name) ->
    if typeof type != 'string'
      type = $ type
      type = type.data('type') || type.attr('type') || type.prop 'tagName'
    plugin = Settings.plugins[type.toLowerCase()]
    return undefined if !plugin?
    hook = plugin[name]
    if typeof hook == 'function' then hook else null

  onReady = []
  waitingJobs = 0
  _h = {
    ###*
      @returns Object A deep clone of the given object.
    ###
    deepClone: (obj) -> if typeof obj == 'object' then JSON.parse JSON.stringify obj else obj
    ###*
      Creates a new Element with given data.
      @param tagName The tag-name of the element to create.
      @param data The attributes to set.
      @param text The text to add into the element.
      @returns HTMLElement The created element.
    ###
    createElement: (tagName, data, text) ->
      el = document.createElement tagName
      el.setAttribute k, v for k, v of data
      el.appendChild document.createTextNode text if text
      el
    ###*
      Calls the init-hook of the given element.
      @param The element to initialize.
    ###
    initElement: (element) ->
      hook = getHook element, 'init'
      return hook.call Settings, $ element if hook?
      null
    ###*
      Calls the destruct-hook of the given element.
      @param The element to destruct.
    ###
    destructElement: (element) ->
      hook = getHook element, 'destruct'
      hook.call Settings, $ element if hook?
    ###*
      Creates and initializes a new element.
      @param type The type of the new element.
      @param tagName The tag-name of the new element.
      @param data The data to forward to create-hook or use as attributes.
      @returns JQuery The created element.
    ###
    createElementOfType: (type, tagName, data) ->
      hook = getHook type, 'create'
      el = if hook? then $ hook.call Settings, type, tagName, data
      else
        data = {} if !data?
        data.type = type if type?
        el = $ _h.createElement tagName || 'input', data
      el.data 'type', type
      _h.initElement el
      el
    ###*
      Creates a new Array that contains values of given Array depending on trim and empty.
      @param trim Whether to trim each value if it has a trim-function.
      @param empty Whether empty values should get added.
      @returns Array The filtered and/or modified Array.
    ###
    cleanArray: (arr, trim, empty) ->
      return arr if !trim && empty
      cleaned = []
      for val in arr
        if trim
          val = if val == true then 1 else if val == false then 0 else if val.trim? then val.trim() else val
        cleaned.push val if empty || val?.length
      cleaned
    isTrue: (value) -> value == 'true' || +value == 1
    isFalse: (value) -> value == 'false' || +value == 0
    ###*
      Calls the get-hook of the given element and returns its result.
      If no hook is specified it gets treated as input-field.
      @param element The element of that the value should get read.
      @returns Object The value of the element.
    ###
    readValue: (element) ->
      trim = !_h.isFalse element.data 'trim'
      empty = !_h.isFalse element.data 'empty'
      hook = getHook element, 'get'
      return hook.call Settings, element, trim, empty if hook?
      if (split = element.data 'split')?
        empty = _h.isTrue element.data 'empty'
        _h.cleanArray (element.val()?.split(split || ',') || []), trim, empty
      else
        val = if trim then element.val()?.trim() else element.val()
        if empty || val != undefined && val?.length != 0 then val else undefined
    ###*
      Calls the set-hook of the given element.
      If no hook is specified it gets treated as input-field.
      @param element The JQuery-Object of the element to fill.
      @param value The value to set.
    ###
    fillField: (element, value) ->
      trim = element.data 'trim'
      trim = trim != 'false' && +trim != 0
      hook = getHook element, 'set'
      return hook.call Settings, element, value, trim if hook?
      if value instanceof Array
        value = value.join element.data('split') || if trim then ', ' else ','
      value = if trim && typeof value?.trim == 'function' then value.trim().toString()
      else if value?
        if trim then value.toString().trim() else value.toString()
      else
        ''
      element.val value if value?
    ###*
      Calls the init-hook and {@link _h.fillField} on each field within wrapper-object.
      @param wrapper The wrapper-element to set settings within.
    ###
    initFields: (wrapper)->
      $('[data-key]', wrapper).each (ignored, field) ->
        field = $ field
        hook = getHook field, 'init'
        hook.call Settings, field if hook?
        keyParts = field.data('key').split '.'
        value = Settings.get()
        value = value[k] for k in keyParts when k && value?
        _h.fillField field, value
    ###*
      Increases the amount of jobs before settings are ready by given amount.
      @param amount The amount of jobs to register.
    ###
    registerReadyJobs: (amount) -> waitingJobs += amount
    ###*
      Decreases the amount of jobs before settings are ready by given amount or 1.
      If the amount is less or equal 0 all callbacks registered by {@link _h.whenReady} get called.
      @param amount The amount of jobs that finished.
    ###
    beforeReadyJobsDecreased: (amount = 1) ->
      if waitingJobs > 0
        waitingJobs -= amount
        if waitingJobs <= 0
          cb() for cb in onReady
          onReady = []
    ###*
      Calls the given callback when the settings are ready.
      @param callback The callback.
    ###
    whenReady: (callback) ->
      if waitingJobs <= 0 then callback() else onReady.push callback
  }

  Settings =
    helper: _h
    plugins: {}
    cfg: {}

    ###*
      Returns the saved settings.
      @returns Object The settings.
    ###
    get: -> if Settings.cfg?._settings? then Settings.cfg._settings else Settings.cfg
    ###*
      Registers a new plugin and calls its use-hook.
      A plugin is an object containing a types-property to define its default bindings.
      A plugin may also provide the following properties of type function with [return-value] (parameters):
        use [void] - gets called when the Settings initializes the plugin.
        init [void] (element) - gets called on page-load and every time after the create-hook.
          ; element: The element to initialize.
        create [JQuery-Object] (type, tagName, data) - gets called when a new HTML-instance needs to get created.
          ; type: A string that identifies the plugin itself within this Settings-instance if set as data-type.
          ; tagName: The tag-name that gets requested.
          ; data: Additional data, plugin-dependent meaning.
        destruct [void] (element) - gets called after a HTML-instance got removed from DOM
          ; element: The element that got removed.
        set [void] (element, value, trim) - gets called when the value of the element should be set to the given value.
          ; element: The element to set its value.
          ; value: The value to set.
          ; trim: Whether the value is considered as trimmed.
        get [value] (element, trim, empty) - gets called when the value of the given instance is needed.
          ; element: The element to get its value.
          ; trim: Whether the result should be trimmed.
          ; empty: Whether considered as empty values should get saved too.

      All passed elements are JQuery-Objects.
      @param service The plugin to register.
      @param types The types to bind the plugin to.
    ###
    registerPlugin: (service, types = service.types) ->
      service.types = types
      service.use?.call Settings if service.use?
      for type in types when !Settings.plugins[typeL = type.toLowerCase()]?
        Settings.plugins[typeL] = service
    ###*
      Fetches the settings from server and calls {@link Settings.helper.initField} once the settings are ready.
      @param hash The hash to use as settings-id.
      @param wrapper The wrapper-element to set settings within.
      @param callback The callback to call when done.
    ###
    sync: (hash, wrapper = "form", callback) ->
      socket.emit 'admin.settings.get', hash: hash, (err, values) ->
        if err
          console.log '[settings] Unable to load settings for hash: ', hash
          callback err if typeof callback == 'function'
        else
          Settings.cfg = values
          try Settings.cfg._settings = JSON.parse Settings.cfg._settings if Settings.cfg._settings
          _h.whenReady ->
            _h.initFields wrapper
            callback() if typeof callback == 'function'
    ###*
      Reads the settings from fields and saves them server-side.
      @param hash The hash to use as settings-id.
      @param wrapper The wrapper-element to find settings within.
      @param callback The callback to call when done.
      @param notify Whether to send notification when settings got saved.
    ###
    persist: (hash, wrapper = "form", callback, notify = true) ->
      notSaved = []
      for field in $('[data-key]', wrapper).toArray()
        field = $ field
        value = _h.readValue field
        keyParts = field.data('key').split '.'
        parentCfg = Settings.get()
        if keyParts.length > 1
          parentCfg = parentCfg[k] for k in keyParts[0..keyParts.length - 2] when k && parentCfg?
        if parentCfg?
          lastKey = keyParts[keyParts.length - 1]
          if value? then parentCfg[lastKey] = value else delete parentCfg[lastKey]
        else
          notSaved.push field.data 'key'
      if notSaved.length
        app.alert
          title: 'Attributes Not Saved'
          message: "'#{notSaved.join ', '}' could not be saved. Please contact the plugin-author!"
          type: 'danger'
          timeout: 5000
      settings = Settings.cfg
      settings._settings = JSON.stringify settings._settings if settings?._settings?
      socket.emit 'admin.settings.set',
        hash: hash
        values: settings
      , (err) ->
        if notify
          if err
            app.alert
              title: 'Settings Not Saved'
              type: 'danger'
              message: "NodeBB failed to save the settings."
              timeout: 5000
            console.log '[settings] Unable to set settings for hash: ', hash
          else
            app.alert
              title: 'Settings Saved'
              type: 'success'
              timeout: 2500
        callback err if typeof callback == 'function'

  # ==================== #
  # Settings 2.0 support #
  # ==================== #

    load: (hash, formEl, callback) ->
      socket.emit 'admin.settings.get', hash: hash, (err, values) ->
        if err
          console.log '[settings] Unable to load settings for hash: ', hash
        else
          $(formEl).deserialize values
          callback() if typeof callback == 'function'
    save: (hash, formEl, callback) ->
      formEl = $ formEl
      if !formEl.length
        console.log '[settings] Form not found.'
      else
        values = formEl.serializeObject()
        formEl.find('input[type="checkbox"]').each (i, inputEl) ->
          inputEl = $ inputEl
          values[inputEl.attr 'id'] = 'off' if !inputEl.is ':checked'
        socket.emit 'admin.settings.set',
          hash: hash
          values: values
        , ->
          app.alert
            title: 'Settings Saved'
            type: 'success'
            timeout: 2500
          callback() if typeof callback == 'function'

  # register default plugins
  _h.registerReadyJobs 1
  require defaultPlugins, (args...) ->
    Settings.registerPlugin plugin for plugin in args
    _h.beforeReadyJobsDecreased()

  Settings