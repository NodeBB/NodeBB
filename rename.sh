for f in src/**/**/*.js; do
  git mv "$f" "${f%.js}.ts"
done