
<div class="well">

   
 
	<!-- Change Picture Modal -->
	<div id="change-picture-modal" class="modal hide" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
	  <div class="modal-header">
	    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
	    <h3 id="myModalLabel">Change Picture</h3>
	  </div>
	  <div class="modal-body">

	    <div id="gravatar-box">
		    <img id="user-gravatar-picture" src="" class="img-polaroid user-profile-picture">
		    <span class="user-picture-label">Gravatar</span>
   		    <i class='icon-ok icon-2x'></i>
	    </div>
	    <br/>
	    <div id="uploaded-box">
		    <img id="user-uploaded-picture" src="" class="img-polaroid user-profile-picture">
		    <span class="user-picture-label">Uploaded picture</span>
		    <i class='icon-ok icon-2x'></i>
	    </div>
	    
	    <a id="uploadPictureBtn" href="#">Upload new picture</a>
	    
	  </div>
	  <div class="modal-footer">
	    <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
	    <button id="savePictureChangesBtn" class="btn btn-primary">Save changes</button>
	  </div>
	</div>
	

	<!-- Upload picture modal-->
	<div id="upload-picture-modal" class="modal hide" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
	  <div class="modal-header">
	    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
	    <h3 id="myModalLabel">Upload Picture</h3>
	  </div>
	  <div class="modal-body">
	    
	    <form id="uploadForm" action="/users/uploadpicture" method="post" enctype="multipart/form-data">
	    	<input id="userPhotoInput" type="file" name="userPhoto" >
	    </form>
	    
	    <div id="upload-progress-box" class="progress progress-striped active hide">
			<div id="upload-progress-bar" class="bar" style="width: 0%;"></div>
		</div>
	    
	    <div id="alert-status" class="alert hide"></div>
   		<div id="alert-success" class="alert alert-success hide"></div>
   		<div id="alert-error" class="alert alert-error hide"></div>
   	
	  </div>
	  <div class="modal-footer">
	    <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
	    <button id="pictureUploadSubmitBtn" class="btn btn-primary">Upload Picture</button>
	  </div>
	</div>
    
    <div class="account-username-box">
		<span class="account-username">
			<a href="/users/{username}">{username}</a> >
			<a href="/users/{username}/edit">edit</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="friendsLink" class="pull-right"><a href="/users/{username}/friends">friends</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{username}/edit">edit</a></span>
		</div>
	</div>

	<div class="row-fluid">
		<div class="span3" style="text-align: center; margin-bottom:20px;">
		    <div class="account-picture-block text-center">
		        <img id="user-current-picture" class="user-profile-picture" src="{picture}" /><br/>
		        <a id="changePictureBtn" href="#" class="btn btn-primary">change picture</a>
		    </div>
		</div>
	      
		<div class="span9">
		     <div class="inline-block">
				<form class='form-horizontal'>
				<div class="control-group">
				    <label class="control-label" for="inputEmail">Email</label>
				    <div class="controls">
				      <input type="text" id="inputEmail" placeholder="Email" value="{email}">
				    </div>
				  </div>
				  
				  <div class="control-group">
				    <label class="control-label" for="inputFullname">Full Name</label>
				    <div class="controls">
				      <input type="text" id="inputFullname" placeholder="Full Name" value="{fullname}">
				    </div>
				  </div>
				  
				   <div class="control-group">
				    <label class="control-label" for="inputWebsite">Website</label>
				    <div class="controls">
				      <input type="text" id="inputWebsite" placeholder="http://website.com" value="{website}">
				    </div>
				  </div>
				 
				  <div class="control-group">
				    <label class="control-label" for="inputLocation">Location</label>
				    <div class="controls">
				      <input type="text" id="inputLocation" placeholder="Location" value="{location}">
				    </div>
				  </div>
				  
				  <div class="control-group">
				    <label class="control-label" for="inputBirthday">Birthday</label>
				    <div class="controls">
				      <input type="text" id="inputBirthday" placeholder="mm/dd/yyyy" value="{birthday}">
				    </div>
				  </div>

				  <div class="control-group">
				    <label class="control-label" for="inputSignature">Signature</label>
				    <div class="controls">
				      <textarea id="inputSignature" placeholder="max 150 chars" rows="5">{signature}</textarea>
				    </div>
				  </div>
				 
				 <input type="hidden" id="inputUID" value="{uid}">
				 
				  <div class="form-actions">
				    <a id="submitBtn" href="#" class="btn btn-primary">Save changes</a>
				    <a href="/users/{username}" class="btn">Cancel</a>
				  </div>
				  
				</form>
		    </div>
	    </div>
    </div>  
</div>

<script type="text/javascript">


var gravatarPicture = '{gravatarpicture}';
var uploadedPicture = '{uploadedpicture}';

$(document).ready(function() {
 


    $('#uploadForm').submit(function() {
        status('uploading the file ...');
		
		$('#upload-progress-bar').css('width', '0%');
		$('#upload-progress-box').show();
		
		if(!$('#userPhotoInput').val()) {
			error('select an image to upload!');
			return false;			
		}

        $(this).ajaxSubmit({
 
			error: function(xhr) {
				error('Error: ' + xhr.status);
			},
 			
 			uploadProgress : function(event, position, total, percent) {
 				$('#upload-progress-bar').css('width', percent+'%');
 			},
 			
 
			success: function(response) {
				if(response.error) {
					error(response.error);
					return;
				}
 
				var imageUrlOnServer = response.path;
 				
 				$('#user-current-picture').attr('src', imageUrlOnServer);
 				$('#user-uploaded-picture').attr('src', imageUrlOnServer);
 				
				uploadedPicture = imageUrlOnServer;        
 								
				setTimeout(function() {
					hideAlerts();
		        	$('#upload-picture-modal').modal('hide');
				}, 750);
	        	
				socket.emit('api:updateHeader', { fields: ['username', 'picture'] });
				success('File uploaded successfully!');
            }
		});

		return false;
    });
 
 	function hideAlerts() {
 		$('#alert-status').hide();
		$('#alert-success').hide();
		$('#alert-error').hide();
		$('#upload-progress-box').hide();
 	}
 
    function status(message) {
    	hideAlerts();
		$('#alert-status').text(message).show();
    }
    
    function success(message) {
    	hideAlerts();
		$('#alert-success').text(message).show();
    }
    
    function error(message) {
    	hideAlerts();
		$('#alert-error').text(message).show();
    }
	
	function changeUserPicture(type) { 
		var userData = {
            uid: $('#inputUID').val(),
			type: type
        };
            
		$.post('/users/changepicture',
        	userData,
            function(data) {	
       			socket.emit('api:updateHeader', { fields: ['username', 'picture'] });
            }                
		);
	}
        
	var selectedImageType = '';
    
    $('#submitBtn').on('click',function(){
    	
       var userData = {
            uid:$('#inputUID').val(),
            email:$('#inputEmail').val(),
            fullname:$('#inputFullname').val(),
            website:$('#inputWebsite').val(),
            birthday:$('#inputBirthday').val(),
            location:$('#inputLocation').val(),
            signature:$('#inputSignature').val(),
        };
            
		$.post('/users/doedit',
        	userData,
            function(data) {
            	if(data.error) {
            		app.alert({
				      'alert_id': 'user_profile_updated',
				      type: 'error',
				      title: 'Profile Update Error',
				      message: data.error,
				      timeout: 2000
				    });
            		return;
            	}
            	
				app.alert({
			      'alert_id': 'user_profile_updated',
			      type: 'success',
			      title: 'Profile Updated',
			      message: 'Your profile has been updated successfully',
			      timeout: 2000
			    });
            }
		);
		return false;
    });
    
    function updateImages() {
		var currentPicture = $('#user-current-picture').attr('src');

		if(gravatarPicture) {
        	$('#user-gravatar-picture').attr('src', gravatarPicture);
        	$('#gravatar-box').show();
        }
        else
        	$('#gravatar-box').hide();

    	if(uploadedPicture) {
        	$('#user-uploaded-picture').attr('src', uploadedPicture);
        	$('#uploaded-box').show();
        }
        else
        	$('#uploaded-box').hide();
        	
        	
         if(currentPicture == gravatarPicture)
	        $('#gravatar-box .icon-ok').show();
		else
	        $('#gravatar-box .icon-ok').hide();
	        
        if(currentPicture == uploadedPicture)
	        $('#uploaded-box .icon-ok').show();
		else
	        $('#uploaded-box .icon-ok').hide();
    }
    
    
    $('#changePictureBtn').on('click', function() {
		selectedImageType = '';
		updateImages();
    	
    	$('#change-picture-modal').modal('show');
    	
    	return false;
    });
    
    $('#gravatar-box').on('click', function(){
		$('#gravatar-box .icon-ok').show();
        $('#uploaded-box .icon-ok').hide();
        selectedImageType = 'gravatar';
	});
	
	$('#uploaded-box').on('click', function(){
		$('#gravatar-box .icon-ok').hide();
        $('#uploaded-box .icon-ok').show();
        selectedImageType = 'uploaded';
	});
	
	$('#savePictureChangesBtn').on('click', function() {
    	$('#change-picture-modal').modal('hide');

    	if(selectedImageType) {
        	changeUserPicture(selectedImageType);
        	
        	if(selectedImageType == 'gravatar')
		        $('#user-current-picture').attr('src', gravatarPicture);		
			else if(selectedImageType == 'uploaded')
		        $('#user-current-picture').attr('src', uploadedPicture);						
        }
    	
	});
	
	$('#upload-picture-modal').on('hide', function() {
		$('#userPhotoInput').val('');
	});
	
	$('#uploadPictureBtn').on('click', function(){
		
    	$('#change-picture-modal').modal('hide');
    	$('#upload-picture-modal').modal('show');

    	hideAlerts();
    	
    	return false;
	});
	
	$('#pictureUploadSubmitBtn').on('click', function() {
		$('#uploadForm').submit();
	});
    
    
});
</script>