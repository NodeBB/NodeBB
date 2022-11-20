<a class="btn btn-primary mb-3" href="{config.relative_path}/admin/manage/categories">
	<i class="fa fa-fw fa-chevron-left"></i> [[admin/manage/categories:analytics.back]]
</a>

<h5>[[admin/manage/categories:analytics.title, {name}]]</h5>
<hr />

<div class="row">
	<div class="col-sm-6 text-center">
		<div class="card">
			<div class="card-body">
				<div><canvas id="pageviews:hourly" height="250"></canvas></div>
				<p>

				</p>
			</div>
			<div class="card-footer"><small>[[admin/manage/categories:analytics.pageviews-hourly]]</div>
		</div>
	</div>
	<div class="col-sm-6 text-center">
		<div class="card">
			<div class="card-body">
				<div><canvas id="pageviews:daily" height="250"></canvas></div>
				<p>

				</p>
			</div>
			<div class="card-footer"><small>[[admin/manage/categories:analytics.pageviews-daily]]</div>
		</div>
	</div>
</div>
<div class="row">
	<div class="col-sm-6 text-center">
		<div class="card">
			<div class="card-body">
				<div><canvas id="topics:daily" height="250"></canvas></div>
				<p>

				</p>
			</div>
			<div class="card-footer"><small>[[admin/manage/categories:analytics.topics-daily]]</div>
		</div>
	</div>
	<div class="col-sm-6 text-center">
		<div class="card">
			<div class="card-body">
				<div><canvas id="posts:daily" height="250"></canvas></div>
				<p>

				</p>
			</div>
			<div class="card-footer"><small>[[admin/manage/categories:analytics.posts-daily]]</div>
		</div>
	</div>
</div>