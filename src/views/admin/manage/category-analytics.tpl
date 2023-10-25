
<div class="px-lg-4">

	<div class="row border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center">
		<div class="col-12 px-0 mb-1 mb-md-0 d-flex justify-content-between align-items-center">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/categories:analytics.title, {name}]]</h4>
			<!-- IMPORT admin/partials/category/selector-dropdown-right.tpl -->
		</div>
	</div>


	<hr />
	<div class="row ">
		<div class="col-sm-6 text-center">
			<div class="card">
				<div class="card-body">
					<div class="position-relative" style="aspect-ratio: 2;">
						<canvas id="pageviews:hourly"></canvas>
					</div>
				</div>
				<div class="card-footer"><small>[[admin/manage/categories:analytics.pageviews-hourly]]</div>
			</div>
		</div>
		<div class="col-sm-6 text-center">
			<div class="card">
				<div class="card-body">
					<div class="position-relative" style="aspect-ratio: 2;">
						<canvas id="pageviews:daily" height="250"></canvas>
					</div>
				</div>
				<div class="card-footer"><small>[[admin/manage/categories:analytics.pageviews-daily]]</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-sm-6 text-center">
			<div class="card">
				<div class="card-body">
					<div class="position-relative" style="aspect-ratio: 2;">
						<canvas id="topics:daily" height="250"></canvas>
					</div>
				</div>
				<div class="card-footer"><small>[[admin/manage/categories:analytics.topics-daily]]</div>
			</div>
		</div>
		<div class="col-sm-6 text-center">
			<div class="card">
				<div class="card-body">
					<div class="position-relative" style="aspect-ratio: 2;">
						<canvas id="posts:daily" height="250"></canvas>
					</div>
				</div>
				<div class="card-footer"><small>[[admin/manage/categories:analytics.posts-daily]]</div>
			</div>
		</div>
	</div>
</div>