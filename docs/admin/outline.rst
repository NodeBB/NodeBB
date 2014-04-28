Administrative Functions
========================

.. note::

    These docs are out of date. If you are interested in updating these (preferably with screenshots) let us know on the `community forum <https://community.nodebb.org>`_ because we are planning on a design overhaul of the ACP soon.


**To view the admin panel** (if you are an admin): `http://your_nodebb_domain.com/admin`

**Top Menu** (all can be easily reached by other means)
  * NodeBB ACP (Administrator Control Panel: this view)
    * `http://your_nodebb_domain.com/admin/index` (see Home below)
  * Forum
    * `http://your_nodebb_domain.com` (your main forum)
  * Home
    * `http://your_nodebb_domain.com/admin/index` (see Home below)
  * Settings
    * `http://your_nodebb_domain.com/admin/settings` (see Settings below)

**Side Menu: NodeBB**
  * Home
    * `http://your_nodebb_domain.com/admin/index`
    * Links all go to nodebb.com homepage
      * NOTE: should all the links go to same place? 
    * Message reminder of what version this is and to check for updates (See :doc:`Upgrading NodeBB <../upgrading/index>`)
      * NOTE: would a link to where the latest stable version is help?
    * Active Users
      * lists number users per page-path (?)
      * NOTE: not clear exactly what the paths mean or how to visit that path


  * Categories
    * `http://your_nodebb_domain.com/admin/categories`
    * Filters: Active, Disabled, Unit Tests
    * List of Categories:
      * Icon, Name, Desc, Action: Disable
    * Actions: Save, Add New

  * Users
    * `http://your_nodebb_domain.com/admin/users`
    * Filters: Latest Users, Top Posters, Most Reputation, Action: Search
    * List of Users:
      * Icon, Link: Name, Reputation(star), Number Posts(pencil), Action: Ban
    * Action: Load More

  * Groups
    * `http://your_nodebb_domain.com/admin/groups`
     * List of Groups
      * Name, Desc, Icon
    * Action: Delete Group
      * NOTE: What exactly can Groups be set up to do, besides Admin?
  
  * Topics
    * `http://your_nodebb_domain.com/admin/topics`
    * List of Topics
      * Name [link to topic], Posted When and By, Number posts (Topic+Replies), Thread Actions: Pin(pushpin), Lock(lock), Delete(trashcan)
    * Action: Load More Topics

    * Topic [from List of Topics link]
    * Normal View of Topic+Reply Posts but with: 
      * Link, Edit, Delete Actions all enabled for each Post
      * Thread Tools:
        * Pin, Lock, Move, Delete

  * Themes (See :doc:`Theming NodeBB <../themes/create>`)
    * `http://your_nodebb_domain.com/admin/themes`
    * List of (Custom | Bootswatch) Themes 
      * Actions: Use, Preview
    * Action: Revert (to base)

  * Plugins (See :doc:`Writing Plugins for NodeBB <../plugins/create>`)
    * `http://your_nodebb_domain.com/admin/plugins`
    * List of Plugins
      * Action: De/activate
    * Info on making plugins

  * Settings
    * `http://your_nodebb_domain.com/admin/settings`

    * General Settings
      * (textbox) Site Title 	
      * (textbox) Site Description 
      * (textbox) Site Keywords 
      * (textbox) Imgur Client ID 
        * NOTE: How does this function?
      * (textbox) Maximum User Image Size

    * Privilege Thresholds (Use privilege thresholds to manage how much reputation a user must gain to receive moderator access.)
      * (textbox) Manage Thread
      * (textbox) Moderate Users
      * (textbox) Create Pinned Topics
	
    * Email Settings
      * (textbox) Email Address (The following email address refers to the email that the recipient will see in the "From" and "Reply To" fields.)
      * (textbox) SMTP Server Host (Default: 127.0.0.1)
      * (textbox) SMTP Server Port

    * User Settings
      * (textbox) Minimum Username Length
      * (textbox) Maximum Username Length
      * (textbox) Minimum Password Length

    * Post Settings
      * (textbox) Post Delay
      * (textbox) Minimum Title Length
      * (textbox) Minimum Post Length
      * (checkbox) Use Outgoing Links Warning Page 

    * Action: Save

  * Redis
    * `http://your_nodebb_domain.com/admin/redis`
    * Redis data storage stats

  * Logger
    * `http://your_nodebb_domain.com/admin/logger`
    * (checkbox) Enable HTTP logging  
    * (checkbox) Enable socket.io event logging  
    * (textbox) Path to log file

  * MOTD (Message of the Day)
    * `http://your_nodebb_domain.com/admin/motd`
    * (textarea) You can enter either full HTML or Markdown text.
    * (checkbox) Show the Message of the Day

**Side Menu: Social Authentication** (See :doc:`Enabling Social Network Logins <../admin/sso>`)

  * Twitter
  * `http://your_nodebb_domain.com/admin/twitter`

  * Facebook
  * `http://your_nodebb_domain.com/admin/facebook`

  * Google+
  * `http://your_nodebb_domain.com/admin/gplus`

**Side Menu: Plugins** (Shows installed plugins)

**Side Menu: Unit Tests** (Will run qunit tests)