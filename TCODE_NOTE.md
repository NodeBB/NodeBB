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

Note: Turn off nodebb then ./nodebb dev to refresh after update code


S3 upload config
- npm i @tailee/nodebb-plugin-s3-uploads
- Access to node_modules/@tailee/nodebb-plugin-s3-uploads/index.js
- Replace mime.lookup with mime.getType
- Replace setting object with this: 
  var settings = {
	  "accessKeyId": process.env.AWS_ACCESS_KEY_ID ,
	  "secretAccessKey": process.env.AWS_SECRET_ACCESS_KEY ,
	  "region": process.env.AWS_DEFAULT_REGION || "us-east-1",
	  "bucket": process.env.S3_UPLOADS_BUCKET || undefined,
	  "host": process.env.S3_UPLOADS_HOST || "s3.amazonaws.com",
	  "path": process.env.S3_UPLOADS_PATH || undefined
  };