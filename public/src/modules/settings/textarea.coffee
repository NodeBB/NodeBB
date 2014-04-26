define ->

  Settings = null

  SettingsArea =
    types: ['textarea']
    use: -> Settings = this
    create: -> Settings.helper.createElement 'textarea'
    set: (element, value, trim) ->
      element.val if trim && typeof value?.trim == 'function' then value.trim() else value || ''
    get: (element, trim, empty) ->
      val = if trim then element.val()?.trim() else element.val()
      if empty || val then val else undefined

  SettingsArea