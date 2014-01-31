<div class="outgoing">
	<ol class="breadcrumb">
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="{relative_path}/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
		</li>
		<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<span itemprop="title">[[notifications:outgoing_link]]</span>
		</li>
	</ol>

	<div class="well">
		<h3>
			[[notifications:outgoing_link_message]] {title}.
		</h3>
		<p>
			<a href="{url}" rel="nofollow" class="btn btn-primary btn-lg">[[notifications:continue_to]] {url}</a>
			<a id="return-btn" href="#" class="btn btn-lg btn-warning">[[notifications:return_to]] {title}</a>
		</p>
	</div>
</div>

<script>
	$('#return-btn').on('click', function() {
		history.back();
		return false;
	});
</script>
