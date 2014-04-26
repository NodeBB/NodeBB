define ->

  Settings = null

  addOptions = (element, options) ->
    for optionData in options
      val = optionData.text || optionData.value
      delete optionData.text
      element.append $(Settings.helper.createElement 'option', optionData).text val

  SettingsSelect =
    types: ['select']
    use: -> Settings = this
  # data as array of
    create: (ignore, ignored, data) ->
      el = $ Settings.helper.createElement 'select'
      addOptions el, data['data-options']
      delete data['data-options']
      el
    init: (element) ->
      options = element.data 'options'
      addOptions element, options if options?
    set: (element, value) -> element.val value || ''
    get: (element, ignored, empty) ->
      val = element.val()
      if empty || val then val else undefined

  SettingsSelect