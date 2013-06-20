

var gravatarPicture = templates.get('gravatarpicture');
var uploadedPicture = templates.get('uploadedpicture');

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
			type: type,
			_csrf:$('#csrf_token').val()
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
			_csrf:$('#csrf_token').val()
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