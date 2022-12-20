for f in src/user/**/*.js; do
  git mv "$f" "${f%.js}.ts"
done