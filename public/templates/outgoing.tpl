<div class="outgoing">
	<ol class="breadcrumb">
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="/" itemprop="url"><span itemprop="title">Home</span></a>
		</li>
		<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<span itemprop="title">Outgoing Link</span>
		</li>
	</ol>

	<div class="well">
		<h3>
			You are now leaving NodeBB.
		</h3>
		<p>
			<a href="{url}" rel="nofollow" class="btn btn-primary btn-lg">Continue to {url}</a>
			<a id="return-btn" href="#" class="btn btn-lg btn-warning">Return to NodeBB</a>
		</p>
	</div>
</div>

<script>
	$('#return-btn').on('click', function() {
		history.back();
		return false;
	});
</script>