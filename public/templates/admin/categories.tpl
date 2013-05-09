
<h1>Categories</h1>

<hr />
<ul class="nav nav-pills">
	<li class='active'><a href='/admin/categories/active'>Active</a></li>
	<li class=''><a href='/admin/categories/disabled'>Disabled</a></li>
</ul>


    	
<div class="row-fluid admin-categories">
	<ul class="span12" id="entry-container">
	<!-- BEGIN categories -->
		<li class="entry-row {categories.blockclass}">
			<form class="form-inline">
				<div class="icon">
					<i class="{categories.icon} icon-2x"></i>
				</div>
				<input value="{categories.name}" class="input-medium"></input>
				<select class="blockclass input-medium" data-value="{categories.blockclass}" onchange="update_blockclass(this);">
					<option value="category-purple">category-purple</option>
					<option value="category-darkblue">category-darkblue</option>
					<option value="category-blue">category-blue</option>
					<option value="category-darkgreen">category-darkgreen</option>
					<option value="category-orange">category-orange</option>
				</select>
				<input value="{categories.icon}" class="input-medium" onchange="update_icon(this);"></input>
				<!--<input value="{categories.description}" class="input-medium"></input>-->
				<!--<a target="_blank" href="../category/{categories.slug}">category/{categories.slug}</a>-->

				<!--<div style="float: right">
					<button class="btn btn-large btn-inverse">Save</button>
				</div>-->
			</form>
		</li>

	<!-- END categories -->
	</ul>
</div>


<script type="text/javascript">

function update_blockclass(el) {
	el.parentNode.parentNode.className = 'entry-row ' + el.value;
}
function update_icon(el) {
	jQuery(el.parentNode.parentNode);
}

jQuery('#entry-container').sortable();
jQuery('.blockclass').each(function() {
	jQuery(this).val(this.getAttribute('data-value'));
});


//DRY Failure. this needs to go into an ajaxify onready style fn. Currently is copy pasted into every single function so after ACP is off the ground fix asap 
(function() {
	jQuery('document').ready(function() {
		var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length-1];

		jQuery('.nav-pills li').removeClass('active');
		jQuery('.nav-pills li a').each(function() {
			if (this.getAttribute('href').match(active)) {
				jQuery(this.parentNode).addClass('active');
				return false;
			}
		})
	});
	
}());
</script>