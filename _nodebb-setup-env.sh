#!/usr/bin/env sh

export NBB_URL="nodebb.example.com"
export NBB_PORT="1337"
export NBB_SECRET="nbbsecretcookie" # only a "cookie" for web setup???
export NBB_ADMIN_USERNAME="admin"
export NBB_ADMIN_PASSWORD="myadminpassword"
export NBB_ADMIN_EMAIL="admin@email.eu"
export NBB_DB="postgres"
export NBB_DB_HOST="mypghost"
export NBB_DB_PORT="5432"
export NBB_DB_USER="nodebb"
export NBB_DB_PASSWORD="nodebbdbpass"
export NBB_DB_NAME="nodebb"
export NBB_DB_SSL="false"

./nodebb setup