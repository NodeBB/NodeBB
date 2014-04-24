define ->
  defaultPlugins = [
    'settings/checkbox'
    'settings/textarea'
    'settings/select'
    'settings/array'
    'settings/key'
  ]

  ###
   # Hooks for plugins:
   #
   # [void]    use() - when the Settings initializes the plugin
   #
   # [void]    init(element) - on page-load and every time after create
   #
   # [element] create(type, tagName, data) - [element accepted by JQuery] when a new HTML-instance needs to get created
   #             (e.g. by array-expansion). Not called at page-load
   #           type: a string that identifies the plugin itself within this Settings-instance if set as data-type
   #           tagName: the tag-name that gets requested
   #           data: additional data with plugin-dependent meaning
   #
   # [void]    destruct(element) - after a HTML-instance got removed from DOM
   #
   # [void]    set(element, value, trim) - when the value of the element should get set to given value
   #           trim: whether the value is considered as trimmed
   #
   # [object]  get(element, trim, empty) - [whatever should be saved] when the value of the given instance is needed
   #             (e.g. when save got clicked)
   #           trim: whether the result should get trimmed
   #           empty: whether considered as empty values should get saved too
   #
   #
   # All given elements are JQuery-objects.
   # All callbacks get triggered within Settings-scope.
   #
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

  getHook = (type, name) ->
    if typeof type != 'string'
      type = $ type
      type = type.data('type') || type.attr('type') || type.prop 'tagName'
    plugin = Settings.plugins[type.toLowerCase()]
    return null if !plugin?
    plugin[name]

  Settings =
    helper:
      deepClone: (obj) -> if typeof obj == 'object' then JSON.parse JSON.stringify obj else obj

      createElement: (tagName, data, text) ->
        el = document.createElement tagName
        el.setAttribute k, v for k, v of data
        el.appendChild document.createTextNode text if text
        el

      initElement: (element) ->
        hook = getHook element, 'init'
        return hook.call Settings, $ element if hook?
        null

      destructElement: (element) ->
        hook = getHook element, 'destruct'
        hook.call Settings, $ element if hook?

      createElementOfType: (type, tagName, data) ->
        hook = getHook type, 'create'
        el = if hook? then $ hook.call Settings, type, tagName, data
        else
          data = {} if !data?
          data.type = type if type?
          el = $ Settings.helper.createElement tagName || 'input', data
        el.data 'type', type
        Settings.helper.initElement el
        el

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

      readValue: (field) ->
        trim = !Settings.helper.isFalse field.data 'trim'
        empty = !Settings.helper.isFalse field.data 'empty'
        hook = getHook field, 'get'
        return hook.call Settings, field, trim, empty if hook?
        if (split = field.data 'split')?
          empty = Settings.helper.isTrue field.data 'empty'
          Settings.helper.cleanArray (field.val()?.split(split || ',') || []), trim, empty
        else
          val = if trim then field.val()?.trim() else field.val()
          if empty || val? && val.length != 0 then val else null

      fillField: (field, value) ->
        trim = field.data 'trim'
        trim = trim != 'false' && +trim != 0
        hook = getHook field, 'set'
        return hook.call Settings, field, value, trim if hook?
        field.val value if value? && typeof field.val == 'function'
        if value instanceof Array
          value = value.join field.data('split') || if trim then ', ' else ','
        if trim && typeof value?.trim == 'function' then value.trim().toString()
        else
          if value?
            if trim then value.toString().trim() else value.toString()
          else
            ''

      initFields: ->
        $('[data-key]', Settings.wrapper).each (ignored, field) ->
          field = $ field
          hook = getHook field, 'init'
          hook.call Settings, field if hook?
          keyParts = field.data('key').split '.'
          value = Settings.get()
          value = value[k] for k in keyParts when k && value?
          Settings.helper.fillField field, value
        $('#save').click (e) ->
          e.preventDefault()
          Settings.persist()

      onReady: []
      waitingJobs: 1
      doReadyStep: ->
        if Settings.helper.waitingJobs > 0
          Settings.helper.waitingJobs--
          if Settings.helper.waitingJobs == 0
            cb() for cb in Settings.helper.onReady
            Settings.helper.onReady = []
      whenReady: (cb) ->
        if Settings.helper.waitingJobs == 0 then cb() else Settings.helper.onReady.push cb

    hash: ''
    wrapper: ''
    plugins: {}
    cfg: {}

    get: -> if Settings.cfg?._settings? then Settings.cfg._settings else Settings.cfg

    registerPlugin: (service, types = service.types) ->
      service.types = types
      service.use?.call Settings if service.use?
      for type in types when !Settings.plugins[typeL = type.toLowerCase()]?
        Settings.plugins[typeL] = service

    init: (hash, wrapper = "form", callback) ->
      Settings.hash = hash
      Settings.wrapper = wrapper
      require defaultPlugins, (args...) ->
        Settings.registerPlugin plugin for plugin in args
        Settings.helper.doReadyStep()
      Settings.sync callback

    sync: (callback) ->
      socket.emit 'admin.settings.get', hash: Settings.hash, (err, values) ->
        if err
          console.log '[settings] Unable to load settings for hash: ', Settings.hash
          callback err if typeof callback == 'function'
        else
          Settings.cfg = values
          try Settings.cfg._settings = JSON.parse Settings.cfg._settings if Settings.cfg._settings
          Settings.helper.whenReady ->
            Settings.helper.initFields()
            callback() if typeof callback == 'function'

    persist: (callback) ->
      notSaved = []
      for field in $('[data-key]', Settings.wrapper).toArray()
        field = $ field
        value = Settings.helper.readValue field
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
          timeout: 5000
          title: 'Attributes Not Saved'
          message: "'#{notSaved.join ', '}' could not be saved. Please contact the plugin-author!"
          type: 'danger'
      settings = Settings.cfg
      settings._settings = JSON.stringify settings._settings if settings?._settings?
      socket.emit 'admin.settings.set',
        hash: Settings.hash
        values: settings
      , ->
        app.alert
          title: 'Settings Saved'
          type: 'success'
          timeout: 2500
        callback() if typeof callback == 'function'

#########################
# Settings 2.0 support: #
#########################

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