Settings Framework
==========================

If you want to make your plugin customizable you may use the Settings Framework NodeBB offers.

Server-Side Access
------------------

First you need some default settings, just create a new object for this:

.. code:: javascript

    var defaultSettings = {
            booleans: {
                someBool: true,
                moreBools: [false, false, true]
            },
            strings: {
                someString: 'hello world',
                multiLineString: 'some\nlong\ntext',
                arrayOfStrings: ['some\nlong\ntexts', 'and another one']
            },
            numbers: {
                multiArrayDimensions: [[42,42],[21,21]],
                multiArrayDimensions2: [[42,42],[]],
                justSomeNumbers: [],
                oneNumber: 3,
                anotherNumber: 2
            },
            someKeys: ['C+S+#13'] // Ctrl+Shift+Enter
        };

Now you can use the server-side settings-module to access the saved settings like this:

.. code:: javascript

    var Settings = module.parent.require('./settings');
    var mySettings = new Settings('myPlugin', '0.1', defaultSettings, function() {
        // the settings are ready and can accessed.
        console.log(mySettings === this); // true
        console.log(this.get('strings.someString') === mySettings.get().strings.someString); // true
    });

The second parameter should change at least every time the structure of default settings changes. Because of this it's
recommended to use your plugins version.

To use the settings client-side you need to create a WebSocket that delivers the result of ``mySettings.get()``.

The mySettings-object will cache the settings, so be sure to use methods like ``mySettings.sync(callback)`` when the
settings got changed from somewhere else and ``mySettings.persist(callback)`` when you finished
``mySettings.set(key, value)`` calls.

You need to create a socket-listener like following to allow the admin to initiate a synchronization with the settings
stored within database:

.. code:: javascript

    var SocketAdmin = module.parent.require('./socket.io/admin');
    SocketAdmin.settings.syncMyPlugin = function() {
        mySettings.sync();
    };

If you want to add a reset-functionality you need to create another socket-listener:

.. code:: javascript

    SocketAdmin.settings.getMyPluginDefaults = function (socket, data, callback) {
        callback(null, mySettings.createDefaultWrapper());
    };

The methods of the ``mySettings`` object you probably want to use:

+ ``constructor()``
+ ``sync([callback])``
    Reloads the settings from database, overrides local changes.
+ ``persist([callback])``
    Saves the local changes within database.
+ ``get([key])``
    Returns the setting(s) identified by given key. If no key is provided the whole settings-object gets returned. If no
    such setting is saved the default value gets returned.
+ ``set([key, ]value)``
    Sets the setting of given key to given value. Remember that it's just a local change, you need to call ``persist``
    in order to save the changes.
+ ``reset([callback])``
    Persists the default settings.
+ ``getWrapper()``
    Returns the local object as it would get saved within database.
+ ``createWrapper(version, settings)``
    Creates an object like it would get saved within database containing given information and settings.
+ ``createDefaultWrapper()``
    Creates an object like it would get saved within database containing the default settings.

Client-Side Access
------------------

The next step is making the settings available to the admin.

You need to use the :doc:`hooks <hooks>` ``filter:admin.header.build`` (to display a link to your page within ACP) and
``action:app.load`` (to create the needed route).

Within your page you can access the client-side Settings API via

.. code:: javascript

    require(['settings'], function (settings) {
        var wrapper = $('#my_form_id');
        // [1]
        settings.sync('myPlugin', wrapper);
        // [2]
    });

To make a button with the id ``save`` actually save the settings you can add the following at ``[2]``:

.. code:: javascript

    $('#save').click(function(event) {
        event.preventDefault();
        settings.persist('myPlugin', wrapper, function(){
            socket.emit('admin.settings.syncMyPlugin');
        });
    });

As said before the server-side settings-object caches the settings, so we emit a WebSocket to notify the server to
synchronize the settings after they got persisted.

To use a reset-button you can add the following at ``[2]``:

.. code:: javascript

    $('#reset').click(function(event) {
        event.preventDefault();
        socket.emit('admin.settings.getMyPluginDefaults', null, function (err, data) {
            settings.set('myPlugin', data, wrapper, function(){
                socket.emit('admin.settings.syncMyPlugin');
            });
        });
    });

There you go, the basic structure is done.
Now you need to add the form-fields.

Each field needs an attribute ``data-key`` to reference its position within the settings.
The Framework does support any fields whose jQuery-object provides the value via the ``val()`` method.

The plugin to use for a field gets determined by its ``data-type``, ``type`` or tag-name in this order.

Additionally the following plugins are registered by default:
 * array (types: div, array)
    An Array of any other fields.
    Uses the object within ``data-attributes`` to define the array-elements.
    Uses ``data-new`` to define the value of new created elements.
 * key (types: key)
    A field to input keyboard-combinations.
 * checkbox, number, select, textarea
    Handle appropriate fields.

A full list of all attributes that may influence the behavior of the default Framework:

 * data-key:   the key to save/load the value within configuration-object
 * data-type:  highest priority type-definition to determine what kind of element it is or which plugin to associate
 * type:       normal priority type-definition
 * data-empty: if ``false`` or ``0`` then values that are assumed as empty turn into null. data-empty of arrays affect their child-elements
 * data-trim:  if not ``false`` or ``0`` then values will get trimmed as defined by the elements type
 * data-split: if set and the element doesn't belong to any plugin, it's value will get split and joined by its value into the field
 * array-elements:
     + data-split:      separator (HTML allowed) between the elements, defaults to ``', '``
     + data-new:        value to insert into new created elements
     + data-attributes: an object to set the attributes of the child HTML-elements. tagName as special key will set the tag-name of the child HTML-elements
 * key-fields:
     + data-trim:  if ``false`` or ``0`` then the value will get saved as string else as object providing following properties: ``ctrl``, ``alt``, ``shift``, ``meta``, ``code``, ``char``
     + data-split: separator between different modifiers and the key-code of the value that gets saved (only takes effect if trimming)
     + data-short: if not ``false`` or ``0`` then modifier-keys get saved as first uppercase character (only takes effect if trimming)
 * select:
     + data-options: an array of objects containing ``text`` and ``value`` attributes.

The methods of the ``settings`` module:

+ ``registerPlugin(plugin[, types])``
    Registers the given plugin and associates it to the given types if any, otherwise the plugins default types will get
    used.
+ ``get()``
    Returns the saved object.
+ ``set(hash, settings[, wrapper[, callback[, notify]]])``
    Refills the fields with given settings and persists them.
    ``hash`` Identifies your plugins settings.
    ``settings`` The object to save in database (settings-wrapper if you use server-side Settings Framework).
    ``wrapper`` (default: 'form') The DOM-Element that contains all fields to fill.
    ``callback`` (default: null) Gets called when done.
    ``notify`` (default: true) Whether to display saved- and fail-notifications.
+ ``sync(hash[, wrapper[, callback]])``
    Resets the settings to saved ones and refills the fields.
+ ``persist(hash[, wrapper[, callback[, notify]]])``
    Reads the settings from given wrapper (default: 'form') and saves them within database.

For Settings 2.0 support the methods ``load`` and ``save`` are still available but not recommended.

Client-Side Example Template
------------------

An example template-file to use the same settings we already used server-side:

.. code:: html

    <h1>My Plugin</h1>
    <hr />

    <form id="my_form_id">
        <div class="row">
            <p>
                <h2>Settings</h2>
                A boolean: <input type="checkbox" data-key="booleans.someBool"></input><br>
                An array of checkboxes that are selected by default:
                <div data-key="booleans.moreBools" data-attributes='{"data-type":"checkbox"}' data-new='true'></div><br>

                A simple input-field of any common type: <input type="password" data-key="strings.someString"></input><br>
                A simple textarea: <textarea data-key="strings.multiLineString"></textarea><br>
                Array of textareas:
                <div data-key="strings.arrayOfStrings" data-attributes='{"data-type":"textarea"}' data-new='Hello Kitty, ahem... World!'></div><br>

                2D-Array of numbers that persist even when empty (but not empty rows):
                <div data-key="numbers.multiArrayDimensions" data-split="<br>"
                    data-attributes='{"data-type":"array","data-attributes":{"type":"number"}}' data-new='[42,21]'></div><br>
                Same with persisting empty rows, but not empty numbers, if no row is given null will get saved:
                <div data-key="numbers.multiArrayDimensions2" data-split="<br>" data-empty="false"
                    data-attributes='{"data-type":"array","data-empty":true,"data-attributes":{"type":"number","data-empty":false}}' data-new='[42,21]'></div><br>
                Array of numbers (new: 42, step: 21):
                <div data-key="numbers.justSomeNumbers" data-attributes='{"data-type":"number","step":21}' data-new='42'></div><br>
                Select with dynamic options:
                <select data-key="numbers.oneNumber" data-options='[{"value":"2","text":"2"},{"value":"3","text":"3"}]'></select><br>
                Select that loads faster:
                <select data-key="numbers.anotherNumber"><br>
                    <option value="2">2</option>
                    <option value="3">3</option>
                </select>

                Array of Key-shortcuts (new: Ctrl+Shift+7):
                <div data-key="someKeys" data-attributes='{"data-type":"key"}' data-new='Ctrl+Shift+#55'></div><br>
            </p>
        </div>
        <button class="btn btn-lg btn-warning" id="reset">Reset</button>
        <button class="btn btn-lg btn-primary" id="save">Save</button>
    </form>

    <script>
        require(['settings'], function (settings) {
            var wrapper = $('#my_form_id');
            // [1]
            settings.sync('myPlugin', wrapper);
            $('#save').click(function(event) {
                event.preventDefault();
                settings.persist('myPlugin', wrapper, function(){
                    socket.emit('admin.settings.syncMyPlugin');
                });
            });
            $('#reset').click(function(event) {
                event.preventDefault();
                socket.emit('admin.settings.getMyPluginDefaults', null, function (err, data) {
                    settings.set('myPlugin', data, wrapper, function(){
                        socket.emit('admin.settings.syncMyPlugin');
                    });
                });
            });
          });
    </script>

Custom Settings-Elements
------------------

If you want do define your own element-structure you can create a **plugin** for the Settings Framework.

This allows you to use a whole object like a single field which - besides comfort in using multiple similar objects -
allows you to use them within arrays.

A plugin is basically an object that contains at least an attribute ``types`` that contains an array of strings that
associate DOM-elements with your plugin.

You can add a plugin at ``[1]`` using the method ``settings.registerPlugin``.

To customize the way the associated fields get interpreted you may add the following methods to your plugin-object:

All given elements are instances of JQuery.

All methods get called within Settings-scope.

+ ``use()``
    Gets called when the plugin gets registered.
+ ``[HTML-Element|JQuery] create(type, tagName, data)``
    Gets called when a new element should get created (eg. by expansion of an array).
+ ``destruct(element)``
    Gets called when the given element got removed from DOM (eg. by array-splice).
+ ``init(element)``
    Gets called when an element should get initialized (eg. after creation).
+ ``[value] get(element, trim, empty)``
    Gets called whenever the value of the given element is requested.
    ``trim`` Whether the result should get trimmed.
    ``empty`` Whether considered as empty values should get saved too.
+ ``set(element, value, trim)``
    Gets called whenever the value of the given element should be set to given one.
    ``trim`` Whether the value is assumed as trimmed.

For further impression take a look at the
`default plugins <https://github.com/NodeBB/NodeBB/tree/master/public/src/modules/settings>`_.

You should also take a look at the helper-functions within
`Settings <https://github.com/NodeBB/NodeBB/tree/master/public/src/modules/settings.js>`_ in order to create
your own plugins. There are a few methods that take response to call the methods of other plugins when fittingly.
