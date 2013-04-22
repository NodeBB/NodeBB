
/**
 * Module dependencies.
 */

var express = require('./')
  , app = express()

app.get('/:foo?/:bar?', function(req, res){
  console.log(req.params);
});


app.post('/:foo?/:bar?', function(req, res){
  console.log(req.params);
});


app.listen(5555);
console.log('listening on 5555');
