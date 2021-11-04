Configuration and setup
- Clone nodebb
- Check node version, must be 14 or above
- ./nodebb setup
- Press Enter to insert some first setup by default info given in message round bracket or config it with your information
- Enter meteor mongo db uri --> get in meteor project by typing meteor mongo ---> take uri from start to "meteor?" part
- Enter first admin account info
- Add env file
- ./nodebb dev —> to see hook and logs
- ./nodebb start —> to start project and use (no logs)
- Go to Localhost:4567 to see result

S3 upload configuration
- npm i @tailee/nodebb-plugin-s3-uploads
- Clone https://github.com/kimtaizigvy/nodebb-plugin-s3-uploads-fork.git for adjust package
- Access to node_modules/@tailee/nodebb-plugin-s3-uploads/index.js to fix code s3 ---> build and run dev after fix

Note:
- Turn off nodebb then ./nodebb dev to refresh after update code
- ./nodebb build then ./nodebb dev after adjust something in node_modules or anything affect layout


Meteor Login
 - Checkout to add/login-return-data branch to have new adjustment of login api
 - Files:
 	src/controller/authentication.js: for meteor login and login flow (from line 249)
	src/user/create.js: for create method adjustment
 - Flow:
 			Enter account from tcode
			 --> nodebb checking login info
			 --> login by meteor (if fail then stop and throw error)
			 --> if have account in tcode
			 --> take username and get uid in nodebb
			 (if not have account nodebb then wait for create nodebb account with some main information in tcode)
			 --> replace email in nodebb login request with username getting from login info in tcode site
			 --> login with nodebb account (after this step is nodebb login handle)


Upload media in nodebb
 - All uploaded media will be stored in public/uploads's mini folders by their role
   files: for topic and others
	 profile: for personal profile image


Footer and logo change (can't find place to remove footer - but nodebb say go to admin panel is best option)

- Logo and favicon: Login as admin --> go to admin panel (last nav button on header) --> click settings --> choose general
  --> looking for site logo --> upload image
	--> looking for favicon --> upload image

- Footer: Login as admin
--> go to admin panel (last nav button on header)
--> click extend
--> choose widgets
--> find global footer
--> replace html code with this
<footer id="footer" class="container footer">
	<div style="display: flex; flex-direction: column; align-items: center;">
		<img src="https://cdn.jsdelivr.net/gh/ZigvyCorp/tcode-static-files@master/images/CreatiCode_EN.png" width="100px" />
    <span>Copyright©2021 Uplifting Technology, Inc. All rights reserved</span>
	</div>
</footer>