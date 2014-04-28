Creating a new NodeBB Theme
===========================

NodeBB is built on `Twitter Bootstrap <twitter.github.com/bootstrap/>`_, which makes theming incredibly simple.

Packaging for NodeBB
-------------------------------------

NodeBB expects any installed themes to be installed via ``npm``. Each individual theme is an npm package, and users can install themes through the command line, ex.:

.. code:: bash

    npm install nodebb-theme-modern-ui

The theme's folder must contain at least two files for it to be a valid theme:

1. ``theme.json``

2. ``theme.less``

``theme.less`` is where your theme's styles will reside. NodeBB expects LESS to be present in this file, and will precompile it down to CSS on-demand. For more information regarding LESS, take a look at `the project homepage <http://lesscss.org/>`_.

**Note**: A *suggested* organization for ``theme.less`` is to ``@import`` multiple smaller files instead of placing all of the styles in the main ``theme.less`` file.

Configuration
-------------------------------------
The theme configuration file is a simple JSON string containing all appropriate meta data regarding the theme. Please take note of the following properties:

* ``id``: A unique id for a theme (e.g. "my-theme")
* ``name``: A user-friendly name for the theme (e.g. "My Theme")
* ``description``: A one/two line description about the theme (e.g. "This is the theme I made for my personal NodeBB")
* ``screenshot``: A filename (in the same folder) that is a preview image (ideally, 370x250, or an aspect ratio of 1.48:1)
* ``url``: A fully qualified URL linking back to the theme's homepage/project

Child Themes
-------------------------------------

If your theme is based off of another theme, simply modify your LESS files to point to the other theme as a base:

topic.less
^^^^^^^^^^

.. code: css

    @import "../nodebb-theme-vanilla/topic";

    .topic .main-post {
        .post-info {
            font-size: 20px;  // My theme specific override
        }
    }

As ``topic.less`` from the theme ``nodebb-theme-vanilla`` was imported, those styles are automatically incorporated into your theme.

**Important**: If you depend on another theme, make sure that your theme specifically states this in its ``package.json``. For example, for the above theme, as we depend on ``nodebb-theme-vanilla``, we would explicitly state this by adding a new section into the ``package.json`` file:

.. code:: json

    "peerDependencies": {
        "nodebb-theme-vanilla": "~0.0.1"
    }