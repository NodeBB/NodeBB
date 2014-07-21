Writing Plugins for NodeBB
==========================

So you want to write a plugin for NodeBB, that's fantastic! There are a couple of things you need to know before starting that will help you out.

Like WordPress, NodeBB's plugins are built on top of a hook system in NodeBB. This system exposes parts of NodeBB to plugin creators in a controlled way, and allows them to alter content while it passes through, or execute certain behaviours when triggered.

See the full :doc:`list of hooks <hooks>` for more information.

Filters and Actions
------------------

There are two types of hooks: **filters** and **actions**.

**Filters** act on content, and can be useful if you want to alter certain pieces of content as it passes through NodeBB. For example, a filter may be used to alter posts so that any occurrences of "apple" gets changed to "orange". Likewise, filters may be used to beautify content (i.e. code filters), or remove offensive words (profanity filters).

**Actions** are executed at certain points of NodeBB, and are useful if you'd like to *do* something after a certain trigger. For example, an action hook can be used to notify an admin if a certain user has posted. Other uses include analytics recording, or automatic welcome posts on new user registration.

When you are writing your plugin, make sure a hook exists where you'd like something to happen. If a hook isn't present, `file an issue <https://github.com/NodeBB/NodeBB/issues>`_ and we'll include it in the next version of NodeBB.

Configuration
------------------

Each plugin package contains a configuration file called ``plugin.json``. Here is a sample:

.. code:: json

    {
        "id": "my-plugin",
        "name": "My Awesome Plugin",
        "description": "Your plugin's description",
        "url": "Absolute URL to your plugin or a Github repository",
        "library": "./my-plugin.js",
        "staticDirs": {
            "images": "public/images"
        },
        "less": [
            "assets/style.less"
        ],
        "hooks": [
            { "hook": "filter:post.save", "method": "filter" },
            { "hook": "action:post.save", "method": "emailme" }
        ],
        "languages": "path/to/languages"
    }

The ``id`` property is a unique name that identifies the plugin.

The ``library`` property is a relative path to the library in your package. It is automatically loaded by NodeBB (if the plugin is activated).

The ``staticDirs`` property is an object hash that maps out paths (relative to your plugin's root) to a directory that NodeBB will expose to the public at the route ``/plugins/{YOUR-PLUGIN-ID}``.

* e.g. The ``staticDirs`` hash in the sample configuration maps ``/path/to/your/plugin/public/images`` to ``/plugins/my-plugin/images``

The ``less`` property contains an array of paths (relative to your plugin's directory), that will be precompiled into the CSS served by NodeBB.

The ``hooks`` property is an array containing objects that tell NodeBB which hooks are used by your plugin, and what method in your library to invoke when that hook is called. Each object contains the following properties (those with a * are required):

* ``hook``, the name of the NodeBB hook
* ``method``, the method called in your plugin
* ``priority``, the relative priority of the method when it is eventually called (default: 10)

The ``languages`` property is optional, which allows you to set up your own internationalization for your plugin (or theme). Set up a similar directory structure as core, for example: ``language/en_GB/myplugin.json``.

Writing the plugin library
------------------

The core of your plugin is your library file, which gets automatically included by NodeBB if your plugin is activated.

Each method you write into your library takes a certain number of arguments, depending on how it is called:

* Filters send a single argument through to your method, while asynchronous methods can also accept a callback.
* Actions send a number of arguments (the exact number depends how the hook is implemented). These arguments are listed in the :doc:`list of hooks <hooks>`.

Example library method
------------------

If we were to write method that listened for the ``action:post.save`` hook, we'd add the following line to the ``hooks`` portion of our ``plugin.json`` file:

.. code:: json

    { "hook": "action:post.save", "method": "myMethod" }

Our library would be written like so:

.. code:: javascript

    var MyPlugin = {
            myMethod: function(postData) {
                // do something with postData here
            }
        };

Using NodeBB libraries to enhance your plugin
------------------

Occasionally, you may need to use NodeBB's libraries. For example, to verify that a user exists, you would need to call the ``exists`` method in the ``User`` class. To allow your plugin to access these NodeBB classes, use ``module.parent.require``:

.. code:: javascript

    var User = module.parent.require('./user');
    User.exists('foobar', function(err, exists) {
        // ...
    });

Installing the plugin
------------------

In almost all cases, your plugin should be published in `npm <https://npmjs.org/>`_, and your package's name should be prefixed "nodebb-plugin-". This will allow users to install plugins directly into their instances by running ``npm install``.

When installed via npm, your plugin **must** be prefixed with "nodebb-plugin-", or else it will not be found by NodeBB.

As of v0.0.5, "installing" a plugin by placing it in the ``/plugins`` folder is still supported, but keep in mind that the package ``id`` and its folder name must match exactly, or else NodeBB will not be able to load the plugin. *This feature may be deprecated in later versions of NodeBB*.

Testing
------------------

Run NodeBB in development mode:

.. code::

    ./nodebb dev

This will expose the plugin debug logs, allowing you to see if your plugin is loaded, and its hooks registered. Activate your plugin from the administration panel, and test it out.

Disabling Plugins
-------------------

You can disable plugins from the ACP, but if your forum is crashing due to a broken plugin you can reset all plugins by executing

.. code::

    ./nodebb reset plugins

Alternatively, you can disable one plugin by running

.. code::

    ./nodebb reset plugin="nodebb-plugin-im-broken"