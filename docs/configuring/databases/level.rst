LevelDB
=======

Follow the instructions on the [homepage](https://github.com/designcreateplay/NodeBB/wiki) but feel free to omit the Redis installation.

After cloning NodeBB, ensure that you run:

    npm install levelup leveldown


Finally, set up a directory to store your LevelDB database, for example:

    mkdir /var/level/

Run the NodeBB install, select `level` when it prompts you for your database. If you created the folder as above, you can leave the rest of the questions as default.