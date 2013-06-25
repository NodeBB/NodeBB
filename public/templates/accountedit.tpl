
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
				<input id="imageUploadCsrf" type="hidden" name="_csrf" value="">
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
			<a href="/users/{userslug}">{username}</a> >
			<a href="/users/{userslug}/edit">edit</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="followersLink" class="pull-right"><a href="/users/{userslug}/followers">followers</a></span>
			<span id="followingLink" class="pull-right"><a href="/users/{userslug}/following">following</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{userslug}/edit">edit</a></span>
		</div>
	</div>

	<div class="row-fluid">
		<div class="span2" style="text-align: center; margin-bottom:20px;">
			<div class="account-picture-block text-center">
				<img id="user-current-picture" class="user-profile-picture" src="{picture}" /><br/>
				<a id="changePictureBtn" href="#" class="btn btn-primary">change picture</a>
			</div>
		</div>
		  
		<div class="span10">
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
							<input type="date" id="inputBirthday" placeholder="mm/dd/yyyy" value="{birthday}">
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

<input type="hidden" template-variable="gravatarpicture" value="{gravatarpicture}" />
<input type="hidden" template-variable="uploadedpicture" value="{uploadedpicture}" />

<script type="text/javascript" src="/src/forum/accountedit.js"></script>