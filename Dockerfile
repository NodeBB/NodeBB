#***********************************************
# To run a docker instance 
# from the root of nodebb folder
# 1) Build a nodebb image  and name it (-tag)nodebb. 
#       You can name it whatever you want it needs to be lowercase. 
#       Notice that there is a period at the end of the cmd -> that sets the location context to current directory
#       This could take a little time. 
#    cmd->   docker build --rm -f Dockerfile -t nodebb:latest .  
# 2) Create a container and map a external -p(port) 4567:4567 container port and name the container myNodeBB(this can be any name).
#    cmd ->  docker run -p 4567:4567 --name myNodeBB nodebb
# 3) Go to localhost:4567 to configure nodebb 
# 4) on your first run you will set up your datastore (redis/mongo) and then set the admin credentials
#    After successfull set up the docker instance will stop. It does this as it tries and restart the node server and this casues the instance to close.  
# 5) start the container again 
#    cmd ->  docker start myNodeBB
# 6) Finished!  Go to localhost:4567 and have fun using nodeBB   
#***********************************************
# The base image is the latest node (LTS) on jessie (debian)
# -onbuild will install the node dependencies found in the project package.json
# and copy its content in /usr/src/app, its WORKDIR
#FROM node:8.7-onbuild
FROM node:6.11-onbuild

ENV NODE_ENV=production \
    daemon=false \
    silent=false

# nodebb setup will ask you for connection information to a redis (default), mongodb then run the forum
# nodebb upgrade is not included and might be desired
CMD node app --setup && npm start

# the default port for NodeBB is exposed outside the container
EXPOSE 4567
