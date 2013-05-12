
<div class="well">

    <div class="alert" id="message" style="display:none">
        <button type="button" class="close" data-dismiss="message">&times;</button>
        <strong></strong>
        <p></p>
    </div>

 
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
   		    <i class='icon-ok'></i>
	    </div>
	    
	    <div id="uploaded-box">
		    <img id="user-uploaded-picture" src="" class="img-polaroid user-profile-picture">
		    <span class="user-picture-label">Uploaded picture</span>
		    <i class='icon-ok'></i>
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
	    
	    <form id="uploadForm" action="/pictureupload" method="post" enctype="multipart/form-data">
	    	<input id="userPhotoInput" type="file" name="userPhoto" >
	    </form>
	    
	    <span id="status" />
   	
	  </div>
	  <div class="modal-footer">
	    <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
	    <button id="pictureUploadSubmitBtn" class="btn btn-primary">Upload Picture</button>
	  </div>
	</div>


    <!-- BEGIN user -->
    
    <div class="account-username-box">
        <span class="account-username"><a href="/users/{user.username}">{user.username}</a></span>
        <span class="pull-right"><a href="/users/{user.username}/edit">edit</a></span>
    </div>

    <div class="account-picture-block text-center">
        <img id="user-current-picture" class="user-profile-picture" src="{user.picture}" /><br/>
        <a id="changePictureBtn" href="#">change picture</a>
    </div>
  
      
     <div class="inline-block">
         <form class='form-horizontal'>
             <div class="control-group">
                <label class="control-label" for="inputEmail">Email</label>
                <div class="controls">
                  <input type="text" id="inputEmail" placeholder="Email" value="{user.email}">
                </div>
              </div>
              
              <div class="control-group">
                <label class="control-label" for="inputFullname">Full Name</label>
                <div class="controls">
                  <input type="text" id="inputFullname" placeholder="Full Name" value="{user.fullname}">
                </div>
              </div>
              
               <div class="control-group">
                <label class="control-label" for="inputWebsite">Website</label>
                <div class="controls">
                  <input type="text" id="inputWebsite" placeholder="http://website.com" value="{user.website}">
                </div>
              </div>
             
              <div class="control-group">
                <label class="control-label" for="inputLocation">Location</label>
                <div class="controls">
                  <input type="text" id="inputLocation" placeholder="Location" value="{user.location}">
                </div>
              </div>
              
              <div class="control-group">
                <label class="control-label" for="inputBirthday">Birthday</label>
                <div class="controls">
                  <input type="text" id="inputBirthday" placeholder="dd/mm/yyyy" value="{user.birthday}">
                </div>
              </div>
             
             <input type="hidden" id="inputUID" value="{user.uid}">
             
              <div class="form-actions">
                <a id="submitBtn" href="" class="btn btn-primary">Save changes</a>
                <a href="/users/{user.username}" class="btn">Cancel</a>
            </div>
              
         </form>
    </div>
    
    <!-- how to pass data to the script ?? -->
	<div id="user-data-picture" class="hide">{user.picture}</div>
	<div id="user-data-gravatarpicture" class="hide">{user.gravatarpicture}</div>
	<div id="user-data-uploadedpicture" class="hide">{user.uploadedpicture}</div>

    
    <!-- END user -->

</div>



<script type="text/javascript">

$(document).ready(function() {
 
    $('#uploadForm').submit(function() {
        status('uploading the file ...');
 
        $(this).ajaxSubmit({
 
			error: function(xhr) {
				status('Error: ' + xhr.status);
			},
 
			success: function(response) {
				if(response.error) {
					status('Opps, something bad happened');
					return;
				}
 
				var imageUrlOnServer = response.path;
 				
 				$('#user-current-picture').attr('src', imageUrlOnServer);
 				$('#user-uploaded-picture').attr('src', imageUrlOnServer);
 				
				$('#user-data-uploadedpicture').html(imageUrlOnServer);        
 								
	        	$('#upload-picture-modal').modal('hide');
	        	
				socket.emit('api:updateHeader', { fields: ['username', 'picture'] });
				status('');
            }
		});

		return false;
    });
 
    function status(message) {
		$('#status').text(message);
    }
});


(function() {	
	
	function submitUserData() {
		var userData = {
            uid:$('#inputUID').val(),
            email:$('#inputEmail').val(),
            fullname:$('#inputFullname').val(),
            website:$('#inputWebsite').val(),
            birthday:$('#inputBirthday').val(),
            location:$('#inputLocation').val()
        };
            
		$.post('/edituser',
        	userData,
            function(data) {

			}                
		);
	}
	
	function changeUserPicture(type) { 
		var userData = {
            uid: $('#inputUID').val(),
			type: type
        };
            
		$.post('/changeuserpicture',
        	userData,
            function(data) {	
       			socket.emit('api:updateHeader', { fields: ['username', 'picture'] });
            }                
		);
	}
	
	
    $(document).ready(function(){
        
		var selectedImageType = '';
        
        $('#submitBtn').on('click',function(){

           submitUserData();

        });
        
        
        function updateImages() {
        	
			var currentPicture = $('#user-current-picture').attr('src');
        	var gravatarPicture = $('#user-data-gravatarpicture').html();        
			var uploadedPicture = $('#user-data-uploadedpicture').html();        

			if(gravatarPicture)
	        	$('#user-gravatar-picture').attr('src', gravatarPicture);
	        else
	        	$('#user-gravatar-picture').addClass('hide');

        	if(uploadedPicture)
	        	$('#user-uploaded-picture').attr('src', uploadedPicture);
	        else
	        	$('#user-uploaded-picture').addClass('hide');
	        	
	        	
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
			        $('#user-current-picture').attr('src', $('#user-data-gravatarpicture').html());		
				else if(selectedImageType == 'uploaded')
			        $('#user-current-picture').attr('src', $('#user-data-uploadedpicture').html());						
	        }
        	
    	});
    	
    	$('#upload-picture-modal').on('hide', function() {
    		$('#userPhotoInput').val('');
    	});
    	
    	$('#uploadPictureBtn').on('click', function(){
    		
        	$('#change-picture-modal').modal('hide');
        	$('#upload-picture-modal').modal('show');
        	
        	$('#pictureUploadSubmitBtn').on('click', function() {
    		    $('#uploadForm').submit();
        	});
        	
        	return false;
    	});
        
    });
}());
</script>