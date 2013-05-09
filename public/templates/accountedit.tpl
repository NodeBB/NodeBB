
<div class="well">
    <div class="alert" id="message" style="display:none">
        <button type="button" class="close" data-dismiss="message">&times;</button>
        <strong></strong>
        <p></p>
    </div>

    <!-- BEGIN user -->
    
    <div class="account-username-box">
        <span class="account-username"><a href="/users/{user.username}">{user.username}</a></span>
        <span class="pull-right"><a href="/users/{user.username}/edit">edit</a></span>
    </div>
    
    

    <div class="account-picture-block">
        <img src="{user.picture}?s=128" />
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
    <!-- END user -->



</div>
<script type="text/javascript">
(function() {
    $(document).ready(function(){
        
        $('#submitBtn').on('click',function(){

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
            
        });
        
    });
}());
</script>