define ->

  Settings = null

  SettingsCheckbox =
    types: ['checkbox']
    use: -> Settings = this
    create: -> Settings.helper.createElement 'input', type: 'checkbox'
    set: (element, value) -> element.prop 'checked', value
    get: (element, trim, empty) ->
      value = element.prop 'checked'
      value = if trim then (if value then 1 else 0) else value
      if empty then value || null else value

  SettingsCheckbox