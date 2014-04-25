**This option is experimental and should not be used on a production environment.**

Both databases **must** be flushed before beginning - there isn't a mechanism yet that detects an existing installation on one database but not another. Until fail-safe's such as these are implemented this option is hidden under the `--advanced` setup flag.

    node app --setup --advanced

Consult the other database guides for instructions on how to set up each specific database. Once you select a secondary database's modules, there's no turning back - until somebody writes an exporter/importer.

Currently this setup is being tested with Redis as the primary store (sets, lists, and sorted sets, because Redis is super fast with these), and Mongo as the hash store (post and user data, because ideally we wouldn't want this in RAM).
