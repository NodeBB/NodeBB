(function(TestBed) {
	TestBed.create_routes = function(app) {

		app.get('/bench/forloop', function(req, res) {
			var benchData = {};

			var myArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

			function f(x) {
				return x;
			}

			var runCount = req.query.runs ? req.query.runs : 1000000;

			function withCaching() {
				var time = process.hrtime();

				for (var n = 0; n < runCount; ++n) {
					for (var i = 0, len = myArray.length; i < len; ++i) {
						f(myArray[i]);
					}
				}

				var diff = process.hrtime(time);
				diff = diff[0] + diff[1] / 1e9;
				return diff;
			}

			function withoutCaching() {
				var time = process.hrtime();

				for (var n = 0; n < runCount; ++n) {
					for (var i = 0; i < myArray.length; ++i) {
						f(myArray[i]);
					}
				}

				var diff = process.hrtime(time);
				diff = diff[0] + diff[1] / 1e9;
				return diff;
			}

			function withForeach() {
				var time = process.hrtime();

				for (var n = 0; n < runCount; ++n) {
					myArray.forEach(function(index) {

					});
				}

				var diff = process.hrtime(time);
				diff = diff[0] + diff[1] / 1e9;
				return diff;
			}

			benchData['runs'] = runCount;

			benchData['withCaching'] = withCaching();
			benchData['withoutCaching'] = withoutCaching();
			benchData['withForeach'] = withForeach();

			res.json(benchData);


		});





	};


}(exports));