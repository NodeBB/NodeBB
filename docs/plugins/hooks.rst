Available Hooks
=============

The following is a list of all hooks present in NodeBB. This list is intended to guide developers who are looking to write plugins for NodeBB. For more information, please consult :doc:`Writing Plugins for NodeBB <create>`.

There are two types of hooks, **filters**, and **actions**. Filters take an input (provided as a single argument), parse it in some way, and return the changed value. Actions take multiple inputs, and execute actions based on the inputs received. Actions do not return anything.

**Important**: This list is by no means exhaustive. Hooks are added on an as-needed basis (or if we can see a potential use case ahead of time), and all requests to add new hooks to NodeBB should be sent to us via the `issue tracker <https://github.com/NodeBB/NodeBB/issues>`_.


Filters
----------

``filter:admin.header_build``
^^^^^^^^^^^^^^^^^^^^^

Allows plugins to create new navigation links in the ACP

``filter:post.save``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: A post's content (markdown text)

Executed whenever a post is created or edited, but before it is saved into the database.

``filter:post.get``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: A post object (javascript Object)

Executed whenever a post is retrieved, but before being sent to the client.

``filter:header.build``
^^^^^^^^^^^^^^^^^^^^^

**Allows plugins to add new navigation links to NodeBB**

``filter:register.build``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**:
 - `req` the express request object (javascript Object)
 - `res` the express response object (javascript Object)
 - `data` the data passed to the template (javascript Object)

**Allows plugins to add new elements to the registration form. At the moment, the only one supported is `data.captcha`**


``filter:post.parse``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: A post or signature's raw text (String)

Executed when a post or signature needs to be parsed from raw text to HTML (for output to client). This is useful if you'd like to use a parser to prettify posts, such as `Markdown <http://daringfireball.net/projects/markdown/>`_, or `BBCode <http://www.bbcode.org/>`_.

``filter:posts.custom_profile_info``
^^^^^^^^^^^^^^^^^^^^^

**Allows plugins to add custom profile information in the topic view's author post block**


``filter:register.check``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**:
 - `req` the express request object (javascript Object)
 - `res` the express response object (javascript Object)
 - `userData` the user data parsed from the form

**Allows plugins to run checks on information and deny registration if necessary.**


``filter:scripts.get``
^^^^^^^^^^^^^^^^^^^^^

**Allows to add client-side JS to the header and queue up for minification on production**


``filter:uploadImage``
^^^^^^^^^^^^^^^^^^^^^

``filter:uploadFile``
^^^^^^^^^^^^^^^^^^^^^

``filter:widgets.getAreas``
^^^^^^^^^^^^^^^^^^^^^

``filter:widgets.getWidgets``
^^^^^^^^^^^^^^^^^^^^^

``filter:search.query``
^^^^^^^^^^^^^^^^^^^^^

``filter:post.parse``
^^^^^^^^^^^^^^^^^^^^^

``filter:messaging.save``
^^^^^^^^^^^^^^^^^^^^^^^^

``filter:messaging.parse``
^^^^^^^^^^^^^^^^^^^^^

``filter:sounds.get``
^^^^^^^^^^^^^^^^^^^^^

``filter:post.getPosts``
^^^^^^^^^^^^^^^^^^^^^

``filter:post.getFields``
^^^^^^^^^^^^^^^^^^^^^

``filter:auth.init``
^^^^^^^^^^^^^^^^^^^^^

``filter:composer.help``
^^^^^^^^^^^^^^^^^^^^^

``filter:topic.thread_tools``
^^^^^^^^^^^^^^^^^^^^^

``filter:user.create``
^^^^^^^^^^^^^^^^^^^^^

``filter:user.delete``
^^^^^^^^^^^^^^^^^^^^^

``filter:user.profileLinks``
^^^^^^^^^^^^^^^^^^^^^

``filter:user.verify.code``
^^^^^^^^^^^^^^^^^^^^^
Parameters: confirm_code

Ability to modify the generated verification code (ex. for using a shorter verification code instead for SMS verification)

``filter:user.custom_fields``
^^^^^^^^^^^^^^^^^^^^^

Parameters: userData

Allows you to append custom fields to the newly created user, ex. mobileNumber

``filter:register.complete``
^^^^^^^^^^^^^^^^^^^^^
Parameters: uid, destination

Set the post-registration destination, or do post-register tasks here.

``filter:widget.render``
^^^^^^^^^^^^^^^^^^^^^



Actions
----------

``action:app.load``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: None

Executed when NodeBB is loaded, used to kickstart scripts in plugins (i.e. cron jobs, etc)

``action:page.load``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: An object containing the following properties:

* ``template`` - The template loaded
* ``url`` - Path to the page (relative to the site's base url)

``action:plugin.activate``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: A String containing the plugin's ``id`` (e.g. ``nodebb-plugin-markdown``)

Executed whenever a plugin is activated via the admin panel.

**Important**: Be sure to check the ``id`` that is sent in with this hook, otherwise your plugin will fire its registered hook method, even if your plugin was not the one that was activated.

``action:plugin.deactivate``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: A String containing the plugin's ``id`` (e.g. ``nodebb-plugin-markdown``)

Executed whenever a plugin is deactivated via the admin panel.

**Important**: Be sure to check the ``id`` that is sent in with this hook, otherwise your plugin will fire its registered hook method, even if your plugin was not the one that was deactivated.

``action:post.save``
^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: A post object (javascript Object)

Executed whenever a post is created or edited, after it is saved into the database.

``action:email.send``
^^^^^^^^^^^^^^^^^^^^^

``action:post.setField``
^^^^^^^^^^^^^^^^^^^^^

``action:topic.edit``
^^^^^^^^^^^^^^^^^^^^^

``action:post.edit``
^^^^^^^^^^^^^^^^^^^^^

``action:post.delete``
^^^^^^^^^^^^^^^^^^^^^

``action:post.restore``
^^^^^^^^^^^^^^^^^^^^^

``action:notification.pushed``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Argument(s)**: A notification object (javascript Object)

Executed whenever a notification is pushed to a user.

``action:config.set``
^^^^^^^^^^^^^^^^^^^^^

``action:topic.save``
^^^^^^^^^^^^^^^^^^^^^

``action:user.create``
^^^^^^^^^^^^^^^^^^^^^

``action:topic.delete``
^^^^^^^^^^^^^^^^^^^^^

``action:user.verify``
^^^^^^^^^^^^^^^^^^^^^
Parameters: uid; a hash of confirmation data (ex. confirm_link, confirm_code)
Useful for overriding the verification system. Currently if this hook is set, the email verification system is disabled outright.


``action:user.set``
^^^^^^^^^^^^^^^^^^^^^
Parameters: field (str), value, type ('set', 'increment', or 'decrement')
Useful for things like awarding badges or achievements after a user has reached some value (ex. 100 posts)

``action:settings.set``
^^^^^^^^^^^^^^^^^^^^^
Parameters: hash (str), object (obj)
Useful if your plugins want to cache settings instead of pulling from DB everytime a method is called. Listen to this and refresh accordingly.


Client Side Hooks
--------------------

``filter:categories.new_topic``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^


``action:popstate``
^^^^^^^^^^^^^^^^^^^

``action:ajaxify.start``
^^^^^^^^^^^^^^^^^^^

``action:ajaxify.loadingTemplates``
^^^^^^^^^^^^^^^^^^^

``action:ajaxify.loadingData``
^^^^^^^^^^^^^^^^^^^

``action:ajaxify.contentLoaded``
^^^^^^^^^^^^^^^^^^^

``action:ajaxify.end``
^^^^^^^^^^^^^^^^^^^

``action:reconnected``
^^^^^^^^^^^^^^^^^^^

``action:connected``
^^^^^^^^^^^^^^^^^^^

``action:disconnected``
^^^^^^^^^^^^^^^^^^^

``action:categories.loading``
^^^^^^^^^^^^^^^^^^^

``action:categories.loaded``
^^^^^^^^^^^^^^^^^^^

``action:categories.new_topic.loaded``
^^^^^^^^^^^^^^^^^^^

``action:topic.loading``
^^^^^^^^^^^^^^^^^^^

``action:topic.loaded``
^^^^^^^^^^^^^^^^^^^

``action:composer.loaded``
^^^^^^^^^^^^^^^^^^^

``action:widgets.loaded``
^^^^^^^^^^^^^^^^^^^