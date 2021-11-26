echo "# [Optional] Install "
if test -n "${SETUP}"
then
  ./nodebb setup
fi

echo "# Checking required modules from ./active_modules"
while read -r module; do
  echo "Installing module $module"
  npm install "$module"
  ./nodebb activate $module
done < ./active_modules

echo "# Building nodebb"
node ./nodebb build

echo "# Launching application"
./nodebb start
