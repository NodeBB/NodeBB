Configuring Databases
=====================

NodeBB has a Database Abstraction Layer (DBAL) that allows one to write  drivers for their database of choice. Currently we have the following options:

.. toctree::
    :hidden:
    :maxdepth: 0

    MongoDB <databases/mongo>
    LevelDB <databases/level>

* Redis (default, see :doc:`installation guides <../installing/os>`)
* :doc:`Mongo <databases/mongo>`
* :doc:`Level <databases/level>`

.. note::

    If you would like to write your own database driver for NodeBB, please visit our `community forum <https://community.nodebb.org>`_ and we can point you in the right direction.


Running a Secondary Database
----------------------------


.. warning::

    **This option is experimental and should not be used on a production environment.**


Both databases **must** be flushed before beginning - there isn't a mechanism yet that detects an existing installation on one database but not another. Until fail-safe's such as these are implemented this option is hidden under the ``--advanced`` setup flag.

.. code:: bash

    node app --setup --advanced

Consult the other database guides for instructions on how to set up each specific database. Once you select a secondary database's modules, there's no turning back - until somebody writes an exporter/importer.

Currently this setup is being tested with Redis as the primary store (sets, lists, and sorted sets, because Redis is super fast with these), and Mongo as the hash store (post and user data, because ideally we wouldn't want this in RAM).
