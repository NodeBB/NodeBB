## 0.4x Refactor Notes

Please remove this file after 0.4x (or perhaps organize it so that we can see the history of breaking changes)

### Immediate Deprecation Notices

* `action:ajaxifying` is no longer triggered on body but on window instead, in line with other similar hooks.
* `filter:server.create_routes` and `filter:admin.create_routes` will have limited support (ajaxify works, but first-load will not). Please have a look at [this plugin](https://github.com/psychobunny/nodebb-plugin-kitchen-sink/blob/master/library.js#L16-L22) for an example on how to create routes in plugins from now on.

### Upcoming Deprecation Warnings

* `filter:footer.build` will be deprecated for 0.4x in favour of the widget system (WIP)
* templates.setGlobal (server-side only) deprecated in favour of using res.locals
* `plugins/fireHook` route will be deprecated for 0.4x
* synchronous hooks will be deprecated for 0.4x - we're reducing complexity by removing the `callbacked: true` property in `plugin.json` - just use callbacks.