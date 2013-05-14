

var user = require('./../user.js');


(function(User) {
	User.create_routes = function(app) {

		
		app.get('/uid/:uid', function(req, res) {
		
			if(!req.params.uid)
				return res.redirect('/403');
			
			user.getUserData(req.params.uid, function(data){
				if(data)
					res.send(data);
				else
					res.send("User doesn't exist!");
			});
			
		});

		app.get('/users', function(req, res) {

			user.getUserList(function(data) {

				res.send(templates['header'] + app.create_route("users", "users") + templates['footer']);

			});
			
		});

		app.get('/users/:username*', function(req, res) {
			if(!req.params.username) {
				res.send("User doesn't exist!");
				return;
			}

			user.get_uid_by_username(req.params.username, function(uid) {
				
				if(!uid) {
					res.redirect('/403');
					return;
				}
				
				user.getUserData(uid, function(data) {
					if(data) {
						res.send(templates['header'] + app.create_route('users/'+data.username, 'account')  + templates['footer']);
					}
					else {
						res.redirect('/403');
					}			
				});
			});		
		});
		
/*
		function api_method(req, res) {
			switch(req.params.method) {
				case 'users' :
					if (req.params.tab == 'search') {
						res.send(JSON.stringify({search_display: 'block', users: []}))
					} else {
						user.getUserList(function(data){
							res.send(JSON.stringify({search_display: 'none', users:data}));
						});
					}
					
					break;
				case 'categories':
					if (req.params.tab == 'disabled') {
						res.send(JSON.stringify({categories: []}));
					} else {
						categories.get(function(data) {
							res.send(JSON.stringify(data));
						});
					}
					break;
				case 'topics' :
					topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
					break;
				default :
					res.send('{}');
			}
		}

		app.get('/api/admin/:method/:tab?*', api_method);
		app.get('/api/admin/:method*', api_method);*/
	};


}(exports));