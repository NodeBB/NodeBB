
<div class="well">
   


	<div class="account-username-box">
		<span class="account-username">
			<a href="/users/{username}">{username}</a> >
			<a href="/users/{username}/friends">friends</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="friendsLink" class="pull-right"><a href="/users/{username}/friends">friends</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{username}/edit">edit</a></span>
		</div>
	</div>

	<div>
	    <!-- BEGIN friends -->

	    <div class="users-box well">
		 	<a href="/users/{friends.username}">
			    <img src="{friends.picture}" class="user-8080-picture"/>
		    </a>
		    <br/>
			<a href="/users/{friends.username}">{friends.username}</a>
		    <br/>
			<div title="reputation">
				<span class='reputation'>{friends.reputation}</span>
				<i class='icon-star'></i>
			</div>
			<div title="post count">
				<span class='postcount'>{friends.postcount}</span>
				<i class='icon-pencil'></i>
			</div>
			<a id="remove-friend-btn" href="#" class="btn remove-friend-btn" friendid="{friends.uid}">Unfollow</a>
		</div>

		<!-- END friends -->
	</div>
	<div id="no-friend-notice" class="alert alert-warning hide">This user doesn't have any friends :(</div>
</div>

<script>

var yourid = '{yourid}';
var theirid = '{theirid}';

var friendCount = '{friendCount}';

(function() {
    
    $(document).ready(function() {
    	
    	if(parseInt(friendCount, 10) === 0) {
    		$('#no-friend-notice').show();
    	}
    	var editLink = $('#editLink');

		if(yourid !== theirid) {
			editLink.hide();
			$('.remove-friend-btn').hide();
		}
		else {
			$('.remove-friend-btn').on('click',function(){

				var removeBtn = $(this);
				var friendid = $(this).attr('friendid');
				
				$.post('/users/removefriend', {uid: friendid},
	            	function(data) {
	            		removeBtn.parent().remove();
					}                
				);
				return false;
			});
		}

        $('.reputation').each(function(index, element) {
        	$(element).html(app.addCommas($(element).html()));
        });
        
        $('.postcount').each(function(index, element) {
        	$(element).html(app.addCommas($(element).html()));
        });
        
    });
    

}());
</script>
