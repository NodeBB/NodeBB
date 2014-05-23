Writing Widgets for NodeBB
==========================

See the original `blog post <http://blog.nodebb.org/widgets-system/>`_ for a high level overview and screenshots of the widget system.

Embedding HTML and JavaScript
-----------------------------

You don't need to be a developer to figure this out. Head over to the Themes control panel and click on the Widgets tab. Create a new HTML widget by dragging and dropping the widget onto whatever template you want. 

Copy and paste HTML or JavaScript into the widget and hit save - you're done!

You can optionally give your widget a container by dragging and dropping from the containers section onto your selected widget.

If you're looking for some sample scripts, head over to our `plugins section <http://community.nodebb.org/category/7/nodebb-plugins>`_ and look for any topic labelled ``nodebb-script-xyz``. Don't forget to submit your scripts and ideas as well!


Creating Widgets
-----------------------------

You can define widgets in both plugins and themes. If you're building a plugin which simply delivers a widget (or collection of widgets), we strongly suggest you follow the ``nodebb-widget-xyz`` nomenclature instead when publishing.

Registering your widget
^^^^^^^^^^^^^^^^^^^^^^^^^^^

Listen to this hook to register your widget:

.. code:: json

    "hook": "filter:widgets.getWidgets", "method": "defineWidgets", "callbacked": true

Pass this back in the array:

.. code:: json
	{
		widget: "widget_namespace",
		name: "My Widget",
		description: "Short description of what it does.",
		content: "<input type=\"text\" name=\"myKey\" class=\"form-control\" />"
	}


``Content`` defines the form that is displayed to customize your widget in the admin panel.

Listening to your widget
^^^^^^^^^^^^^^^^^^^^^^^^^^^

NodeBB core will call your widget on the appropriate page load by way of the hooks system. The hook will be named after your widget's namespace (see previous example) - like so: ``filter:widget.render:widget_namespace``

This will pass in an object with the following useful properties:

* ``obj.area`` - will have ``location``, ``template``, ``url``
* ``obj.data`` - will have your admin-defined data; in the example from the previous section you will be exposed an ``obj.data.myKey``

Defining Widget Areas in Themes
------------------------------------

A Widget Area is characterized by a template and a location. Themes can share widgets if they define the same Widget Areas. If an admin switches themes, widgets that were previously defined in a Widget Area incompatible with the new theme are saved.

Listen to this hook to register your Widget Area:

.. code:: json

    "hook": "filter:widgets.getAreas", "method": "defineWidgetAreas", "callbacked": true

Pass this back in the array:

.. code:: json

	{
		name: "Category Sidebar",
		template: "category.tpl",
		location: "sidebar"
	}


And that's all. You can define as many Widget Areas in your theme as you wish. If you're still stuck, have a look at `this commit <https://github.com/NodeBB/nodebb-theme-cerulean/commit/50e49a9da5a89484fa8001bbda2e613b69f18e86>`_ which upgraded the Cerulean theme to use the widget system.

