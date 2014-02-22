
<div class="categories">
	<h1><i class="fa fa-folder"></i> Categories</h1>
	<hr />

	<button class="btn btn-primary" id="addNew">Add New</button>
	<hr />
	<ul class="nav nav-pills">
		<li class='active'><a href='/admin/categories/active'>Active</a></li>
		<li class=''><a href='/admin/categories/disabled'>Disabled</a></li>
	</ul>

	<div class="row admin-categories">
		<ul class="col-md-12" id="entry-container">
		<!-- BEGIN categories -->
			<li data-cid="{categories.cid}" class="entry-row">
				<div class="row">
					<div class="col-sm-2 hidden-xs text-center">
						<div class="preview-box" style="background: {categories.background}; color: {categories.color}; background-size:cover;">
							<div class="icon">
								<i data-name="icon" value="{categories.icon}" class="fa {categories.icon} fa-2x"></i>
							</div>
						</div><br />
						<!-- IF categories.image -->
						<small class="pointer delete-image"><i data-name="icon" value="fa-times" class="fa fa-times"></i> Delete Image</small>
						<!-- ENDIF categories.image -->
					</div>
					<div class="col-sm-10">
						<form class="form">
							<div class="row">
								<div class="col-sm-4 col-xs-12">
									<div class="form-group">
										<label for="cid-{categories.cid}-name">Category Name</label>
										<input id="cid-{categories.cid}-name" type="text" class="form-control" placeholder="Category Name" data-name="name" value="{categories.name}" />
									</div>
								</div>
								<div class="col-sm-4 hidden-xs">
									<div class="form-group">
										<div class="form-group">
											<label for="cid-{categories.cid}-bgColor">Background Colour</label>
											<input id="cid-{categories.cid}-bgColor" placeholder="#0059b2" data-name="bgColor" value="{categories.bgColor}" class="form-control category_bgColor" />
										</div>
									</div>
								</div>
								<div class="col-sm-4 hidden-xs">
									<div class="form-group">
										<div class="form-group">
											<label for="cid-{categories.cid}-color">Text Colour</label>
											<input id="cid-{categories.cid}-color" placeholder="#fff" data-name="color" value="{categories.color}" class="form-control category_color" />
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12 col-sm-12">
									<div class="form-group">
										<div class="form-group">
											<label for="cid-{categories.cid}-description">Description</label>
											<input id="cid-{categories.cid}-description" data-name="description" placeholder="Category Description" value="{categories.description}" class="form-control category_description description"></input>
										</div>
									</div>
								</div>

							</div>

							<div class="row">
								<div class="col-sm-4 col-xs-12">
									<div class="form-group">
										<label for="cid-{categories.cid}-class">Custom Class</label>
										<input id="cid-{categories.cid}-class" type="text" class="form-control" placeholder="col-md-6 col-xs-6" data-name="class" value="{categories.class}" />
									</div>
								</div>
								<div class="col-sm-4 col-xs-12">
									<div class="form-group">
										<label for="cid-{categories.cid}-imageClass">Image Class</label>
										<input id="cid-{categories.cid}-imageClass" type="text" class="form-control" placeholder="default" data-name="imageClass" value="{categories.imageClass}" />
									</div>
								</div>
								<div class="col-sm-4 col-xs-12">
									<div class="form-group">
										<label for="cid-{categories.cid}-numRecentReplies"># of Recent Replies Displayed</label>
										<input id="cid-{categories.cid}-numRecentReplies" type="text" class="form-control" placeholder="2" data-name="numRecentReplies" value="{categories.numRecentReplies}" />
									</div>
								</div>

							</div>
							<div class="row">
								<div class="col-sm-4 col-xs-12">
									<div class="form-group">
										<label for="cid-{categories.cid}-link">External Link</label>
										<input id="cid-{categories.cid}-link" type="text" class="form-control" placeholder="http://domain.com" data-name="link" value="{categories.link}" />
									</div>
								</div>
								<div class="col-sm-8 col-xs-12">
									<div class="form-group">

										<label>&nbsp;</label>
										<div class="dropdown">
											<button type="button" class="btn btn-default" data-toggle="dropdown"><i class="fa fa-cogs"></i> Options</button>
											<ul class="dropdown-menu" role="menu">
												<li class="permissions"><a href="#"><i class="fa fa-ban"></i> Access Control</a></li>
												<hr />
												<li data-disabled="{categories.disabled}">
													<!-- IF categories.disabled -->
														<a href="#"><i class="fa fa-power-off"></i> Enable</a>
													<!-- ELSE -->
														<a href="#"><i class="fa fa-power-off"></i> Disable</a>
													<!-- ENDIF categories.disabled -->
												</li>
											</ul>
											<button type="button" data-name="image" data-value="{categories.image}" class="btn btn-default upload-button"><i class="fa fa-upload"></i> Image</button>

											<button class="btn btn-primary save">Save</button>
										</div>

									</div>
								</div>
							</div>


							<input type="hidden" data-name="order" data-value="{categories.order}"></input>
						</form>
					</div>
				</div>
			</li>

		<!-- END categories -->
		</ul>


	</div>

	<div id="new-category-modal" class="modal" tabindex="-1" role="dialog" aria-labelledby="Add New Modal" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h3>Create New Category</h3>
				</div>
				<div class="modal-body">
					<div>
						<form class='form-horizontal'>
							<div class="control-group">
								<label class="control-label" for="inputName">Name</label>
								<div class="controls">
									<input class="form-control" type="text" id="inputName" placeholder="Name" value="">
								</div>
							</div>

							<div class="control-group">
								<label class="control-label" for="inputDescription">Description</label>
								<div class="controls">
									<input class="form-control" type="text" id="inputDescription" placeholder="Description" value="">
								</div>
							</div>

							<div class="control-group">
								<label class="control-label" for="inputIcon">Icon</label>
								<div class="controls">
									<div class="icon">
										<i data-name="icon" value="fa-pencil" class="fa fa-pencil fa-2x"></i>
									</div>
								</div>
							</div>
						</form>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" id="create-category-btn" href="#" class="btn btn-primary btn-lg btn-block">Create</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->

	<div id="category-permissions-modal" class="modal permissions-modal fade" tabindex="-1" role="dialog" aria-labelledby="Category Permissions" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h3>Category Permissions</h3>
				</div>
				<div class="modal-body">
					<p>The following users can view &amp; read Topics in this Category</p>
					<ul class="members" id="category-permissions-read"></ul>

					<p>The following users can post and reply to Topics in this Category</p>
					<ul class="members" id="category-permissions-write"></ul>

					<p>The following users are moderators of this Category</p>
					<ul class="members" id="category-permissions-mods"></ul>

					<hr />
					<form role="form">
						<div class="form-group">
							<label for="permission-search">User Search</label>
							<input class="form-control" type="text" id="permission-search" />
						</div>
					</form>
					<ul class="search-results"></ul>

					<hr />
					<form role="form">
						<div class="form-group">
							<label for="permission-group-pick">User Groups</label>
						</div>
					</form>
					<table class="table table-striped groups-results"></table>

				</div>
			</div>
		</div>
	</div>

	<div id="icons" style="display:none;"><div class="icon-container"><div class="row fa-icons">
	 <div class="col-md-3"><i class="fa fa-doesnt-exist"></i></div><div class="col-md-3"><i class="fa fa-glass"></i></div><div class="col-md-3"><i class="fa fa-music"></i></div><div class="col-md-3"><i class="fa fa-search"></i></div><div class="col-md-3"><i class="fa fa-envelope-o"></i></div><div class="col-md-3"><i class="fa fa-heart"></i></div><div class="col-md-3"><i class="fa fa-star"></i></div><div class="col-md-3"><i class="fa fa-star-o"></i></div><div class="col-md-3"><i class="fa fa-user"></i></div><div class="col-md-3"><i class="fa fa-film"></i></div><div class="col-md-3"><i class="fa fa-th-large"></i></div><div class="col-md-3"><i class="fa fa-th"></i></div><div class="col-md-3"><i class="fa fa-th-list"></i></div><div class="col-md-3"><i class="fa fa-check"></i></div><div class="col-md-3"><i class="fa fa-times"></i></div><div class="col-md-3"><i class="fa fa-search-plus"></i></div><div class="col-md-3"><i class="fa fa-search-minus"></i></div><div class="col-md-3"><i class="fa fa-power-off"></i></div><div class="col-md-3"><i class="fa fa-signal"></i></div><div class="col-md-3"><i class="fa fa-cog"></i></div><div class="col-md-3"><i class="fa fa-trash-o"></i></div><div class="col-md-3"><i class="fa fa-home"></i></div><div class="col-md-3"><i class="fa fa-file-o"></i></div><div class="col-md-3"><i class="fa fa-clock-o"></i></div><div class="col-md-3"><i class="fa fa-road"></i></div><div class="col-md-3"><i class="fa fa-download"></i></div><div class="col-md-3"><i class="fa fa-arrow-circle-o-down"></i></div><div class="col-md-3"><i class="fa fa-arrow-circle-o-up"></i></div><div class="col-md-3"><i class="fa fa-inbox"></i></div><div class="col-md-3"><i class="fa fa-play-circle-o"></i></div><div class="col-md-3"><i class="fa fa-repeat"></i></div><div class="col-md-3"><i class="fa fa-refresh"></i></div><div class="col-md-3"><i class="fa fa-list-alt"></i></div><div class="col-md-3"><i class="fa fa-lock"></i></div><div class="col-md-3"><i class="fa fa-flag"></i></div><div class="col-md-3"><i class="fa fa-headphones"></i></div><div class="col-md-3"><i class="fa fa-volume-off"></i></div><div class="col-md-3"><i class="fa fa-volume-down"></i></div><div class="col-md-3"><i class="fa fa-volume-up"></i></div><div class="col-md-3"><i class="fa fa-qrcode"></i></div><div class="col-md-3"><i class="fa fa-barcode"></i></div><div class="col-md-3"><i class="fa fa-tag"></i></div><div class="col-md-3"><i class="fa fa-tags"></i></div><div class="col-md-3"><i class="fa fa-book"></i></div><div class="col-md-3"><i class="fa fa-bookmark"></i></div><div class="col-md-3"><i class="fa fa-print"></i></div><div class="col-md-3"><i class="fa fa-camera"></i></div><div class="col-md-3"><i class="fa fa-font"></i></div><div class="col-md-3"><i class="fa fa-bold"></i></div><div class="col-md-3"><i class="fa fa-italic"></i></div><div class="col-md-3"><i class="fa fa-text-height"></i></div><div class="col-md-3"><i class="fa fa-text-width"></i></div><div class="col-md-3"><i class="fa fa-align-left"></i></div><div class="col-md-3"><i class="fa fa-align-center"></i></div><div class="col-md-3"><i class="fa fa-align-right"></i></div><div class="col-md-3"><i class="fa fa-align-justify"></i></div><div class="col-md-3"><i class="fa fa-list"></i></div><div class="col-md-3"><i class="fa fa-outdent"></i></div><div class="col-md-3"><i class="fa fa-indent"></i></div><div class="col-md-3"><i class="fa fa-video-camera"></i></div><div class="col-md-3"><i class="fa fa-picture-o"></i></div><div class="col-md-3"><i class="fa fa-pencil"></i></div><div class="col-md-3"><i class="fa fa-map-marker"></i></div><div class="col-md-3"><i class="fa fa-adjust"></i></div><div class="col-md-3"><i class="fa fa-tint"></i></div><div class="col-md-3"><i class="fa fa-pencil-square-o"></i></div><div class="col-md-3"><i class="fa fa-share-square-o"></i></div><div class="col-md-3"><i class="fa fa-check-square-o"></i></div><div class="col-md-3"><i class="fa fa-arrows"></i></div><div class="col-md-3"><i class="fa fa-step-backward"></i></div><div class="col-md-3"><i class="fa fa-fast-backward"></i></div><div class="col-md-3"><i class="fa fa-backward"></i></div><div class="col-md-3"><i class="fa fa-play"></i></div><div class="col-md-3"><i class="fa fa-pause"></i></div><div class="col-md-3"><i class="fa fa-stop"></i></div><div class="col-md-3"><i class="fa fa-forward"></i></div><div class="col-md-3"><i class="fa fa-fast-forward"></i></div><div class="col-md-3"><i class="fa fa-step-forward"></i></div><div class="col-md-3"><i class="fa fa-eject"></i></div><div class="col-md-3"><i class="fa fa-chevron-left"></i></div><div class="col-md-3"><i class="fa fa-chevron-right"></i></div><div class="col-md-3"><i class="fa fa-plus-circle"></i></div><div class="col-md-3"><i class="fa fa-minus-circle"></i></div><div class="col-md-3"><i class="fa fa-times-circle"></i></div><div class="col-md-3"><i class="fa fa-check-circle"></i></div><div class="col-md-3"><i class="fa fa-question-circle"></i></div><div class="col-md-3"><i class="fa fa-info-circle"></i></div><div class="col-md-3"><i class="fa fa-crosshairs"></i></div><div class="col-md-3"><i class="fa fa-times-circle-o"></i></div><div class="col-md-3"><i class="fa fa-check-circle-o"></i></div><div class="col-md-3"><i class="fa fa-ban"></i></div><div class="col-md-3"><i class="fa fa-arrow-left"></i></div><div class="col-md-3"><i class="fa fa-arrow-right"></i></div><div class="col-md-3"><i class="fa fa-arrow-up"></i></div><div class="col-md-3"><i class="fa fa-arrow-down"></i></div><div class="col-md-3"><i class="fa fa-share"></i></div><div class="col-md-3"><i class="fa fa-expand"></i></div><div class="col-md-3"><i class="fa fa-compress"></i></div><div class="col-md-3"><i class="fa fa-plus"></i></div><div class="col-md-3"><i class="fa fa-minus"></i></div><div class="col-md-3"><i class="fa fa-asterisk"></i></div><div class="col-md-3"><i class="fa fa-exclamation-circle"></i></div><div class="col-md-3"><i class="fa fa-gift"></i></div><div class="col-md-3"><i class="fa fa-leaf"></i></div><div class="col-md-3"><i class="fa fa-fire"></i></div><div class="col-md-3"><i class="fa fa-eye"></i></div><div class="col-md-3"><i class="fa fa-eye-slash"></i></div><div class="col-md-3"><i class="fa fa-exclamation-triangle"></i></div><div class="col-md-3"><i class="fa fa-plane"></i></div><div class="col-md-3"><i class="fa fa-calendar"></i></div><div class="col-md-3"><i class="fa fa-random"></i></div><div class="col-md-3"><i class="fa fa-comment"></i></div><div class="col-md-3"><i class="fa fa-magnet"></i></div><div class="col-md-3"><i class="fa fa-chevron-up"></i></div><div class="col-md-3"><i class="fa fa-chevron-down"></i></div><div class="col-md-3"><i class="fa fa-retweet"></i></div><div class="col-md-3"><i class="fa fa-shopping-cart"></i></div><div class="col-md-3"><i class="fa fa-folder"></i></div><div class="col-md-3"><i class="fa fa-folder-open"></i></div><div class="col-md-3"><i class="fa fa-arrows-v"></i></div><div class="col-md-3"><i class="fa fa-arrows-h"></i></div><div class="col-md-3"><i class="fa fa-bar-chart-o"></i></div><div class="col-md-3"><i class="fa fa-twitter-square"></i></div><div class="col-md-3"><i class="fa fa-facebook-square"></i></div><div class="col-md-3"><i class="fa fa-camera-retro"></i></div><div class="col-md-3"><i class="fa fa-key"></i></div><div class="col-md-3"><i class="fa fa-cogs"></i></div><div class="col-md-3"><i class="fa fa-comments"></i></div><div class="col-md-3"><i class="fa fa-thumbs-o-up"></i></div><div class="col-md-3"><i class="fa fa-thumbs-o-down"></i></div><div class="col-md-3"><i class="fa fa-star-half"></i></div><div class="col-md-3"><i class="fa fa-heart-o"></i></div><div class="col-md-3"><i class="fa fa-sign-out"></i></div><div class="col-md-3"><i class="fa fa-linkedin-square"></i></div><div class="col-md-3"><i class="fa fa-thumb-tack"></i></div><div class="col-md-3"><i class="fa fa-external-link"></i></div><div class="col-md-3"><i class="fa fa-sign-in"></i></div><div class="col-md-3"><i class="fa fa-trophy"></i></div><div class="col-md-3"><i class="fa fa-github-square"></i></div><div class="col-md-3"><i class="fa fa-upload"></i></div><div class="col-md-3"><i class="fa fa-lemon-o"></i></div><div class="col-md-3"><i class="fa fa-phone"></i></div><div class="col-md-3"><i class="fa fa-square-o"></i></div><div class="col-md-3"><i class="fa fa-bookmark-o"></i></div><div class="col-md-3"><i class="fa fa-phone-square"></i></div><div class="col-md-3"><i class="fa fa-twitter"></i></div><div class="col-md-3"><i class="fa fa-facebook"></i></div><div class="col-md-3"><i class="fa fa-github"></i></div><div class="col-md-3"><i class="fa fa-unlock"></i></div><div class="col-md-3"><i class="fa fa-credit-card"></i></div><div class="col-md-3"><i class="fa fa-rss"></i></div><div class="col-md-3"><i class="fa fa-hdd-o"></i></div><div class="col-md-3"><i class="fa fa-bullhorn"></i></div><div class="col-md-3"><i class="fa fa-bell"></i></div><div class="col-md-3"><i class="fa fa-certificate"></i></div><div class="col-md-3"><i class="fa fa-hand-o-right"></i></div><div class="col-md-3"><i class="fa fa-hand-o-left"></i></div><div class="col-md-3"><i class="fa fa-hand-o-up"></i></div><div class="col-md-3"><i class="fa fa-hand-o-down"></i></div><div class="col-md-3"><i class="fa fa-arrow-circle-left"></i></div><div class="col-md-3"><i class="fa fa-arrow-circle-right"></i></div><div class="col-md-3"><i class="fa fa-arrow-circle-up"></i></div><div class="col-md-3"><i class="fa fa-arrow-circle-down"></i></div><div class="col-md-3"><i class="fa fa-globe"></i></div><div class="col-md-3"><i class="fa fa-wrench"></i></div><div class="col-md-3"><i class="fa fa-tasks"></i></div><div class="col-md-3"><i class="fa fa-filter"></i></div><div class="col-md-3"><i class="fa fa-briefcase"></i></div><div class="col-md-3"><i class="fa fa-arrows-alt"></i></div><div class="col-md-3"><i class="fa fa-users"></i></div><div class="col-md-3"><i class="fa fa-link"></i></div><div class="col-md-3"><i class="fa fa-cloud"></i></div><div class="col-md-3"><i class="fa fa-flask"></i></div><div class="col-md-3"><i class="fa fa-scissors"></i></div><div class="col-md-3"><i class="fa fa-files-o"></i></div><div class="col-md-3"><i class="fa fa-paperclip"></i></div><div class="col-md-3"><i class="fa fa-floppy-o"></i></div><div class="col-md-3"><i class="fa fa-square"></i></div><div class="col-md-3"><i class="fa fa-bars"></i></div><div class="col-md-3"><i class="fa fa-list-ul"></i></div><div class="col-md-3"><i class="fa fa-list-ol"></i></div><div class="col-md-3"><i class="fa fa-strikethrough"></i></div><div class="col-md-3"><i class="fa fa-underline"></i></div><div class="col-md-3"><i class="fa fa-table"></i></div><div class="col-md-3"><i class="fa fa-magic"></i></div><div class="col-md-3"><i class="fa fa-truck"></i></div><div class="col-md-3"><i class="fa fa-pinterest"></i></div><div class="col-md-3"><i class="fa fa-pinterest-square"></i></div><div class="col-md-3"><i class="fa fa-google-plus-square"></i></div><div class="col-md-3"><i class="fa fa-google-plus"></i></div><div class="col-md-3"><i class="fa fa-money"></i></div><div class="col-md-3"><i class="fa fa-caret-down"></i></div><div class="col-md-3"><i class="fa fa-caret-up"></i></div><div class="col-md-3"><i class="fa fa-caret-left"></i></div><div class="col-md-3"><i class="fa fa-caret-right"></i></div><div class="col-md-3"><i class="fa fa-columns"></i></div><div class="col-md-3"><i class="fa fa-sort"></i></div><div class="col-md-3"><i class="fa fa-sort-asc"></i></div><div class="col-md-3"><i class="fa fa-sort-desc"></i></div><div class="col-md-3"><i class="fa fa-envelope"></i></div><div class="col-md-3"><i class="fa fa-linkedin"></i></div><div class="col-md-3"><i class="fa fa-undo"></i></div><div class="col-md-3"><i class="fa fa-gavel"></i></div><div class="col-md-3"><i class="fa fa-tachometer"></i></div><div class="col-md-3"><i class="fa fa-comment-o"></i></div><div class="col-md-3"><i class="fa fa-comments-o"></i></div><div class="col-md-3"><i class="fa fa-bolt"></i></div><div class="col-md-3"><i class="fa fa-sitemap"></i></div><div class="col-md-3"><i class="fa fa-umbrella"></i></div><div class="col-md-3"><i class="fa fa-clipboard"></i></div><div class="col-md-3"><i class="fa fa-lightbulb-o"></i></div><div class="col-md-3"><i class="fa fa-exchange"></i></div><div class="col-md-3"><i class="fa fa-cloud-download"></i></div><div class="col-md-3"><i class="fa fa-cloud-upload"></i></div><div class="col-md-3"><i class="fa fa-user-md"></i></div><div class="col-md-3"><i class="fa fa-stethoscope"></i></div><div class="col-md-3"><i class="fa fa-suitcase"></i></div><div class="col-md-3"><i class="fa fa-bell-o"></i></div><div class="col-md-3"><i class="fa fa-coffee"></i></div><div class="col-md-3"><i class="fa fa-cutlery"></i></div><div class="col-md-3"><i class="fa fa-file-text-o"></i></div><div class="col-md-3"><i class="fa fa-building-o"></i></div><div class="col-md-3"><i class="fa fa-hospital-o"></i></div><div class="col-md-3"><i class="fa fa-ambulance"></i></div><div class="col-md-3"><i class="fa fa-medkit"></i></div><div class="col-md-3"><i class="fa fa-fighter-jet"></i></div><div class="col-md-3"><i class="fa fa-beer"></i></div><div class="col-md-3"><i class="fa fa-h-square"></i></div><div class="col-md-3"><i class="fa fa-plus-square"></i></div><div class="col-md-3"><i class="fa fa-angle-double-left"></i></div><div class="col-md-3"><i class="fa fa-angle-double-right"></i></div><div class="col-md-3"><i class="fa fa-angle-double-up"></i></div><div class="col-md-3"><i class="fa fa-angle-double-down"></i></div><div class="col-md-3"><i class="fa fa-angle-left"></i></div><div class="col-md-3"><i class="fa fa-angle-right"></i></div><div class="col-md-3"><i class="fa fa-angle-up"></i></div><div class="col-md-3"><i class="fa fa-angle-down"></i></div><div class="col-md-3"><i class="fa fa-desktop"></i></div><div class="col-md-3"><i class="fa fa-laptop"></i></div><div class="col-md-3"><i class="fa fa-tablet"></i></div><div class="col-md-3"><i class="fa fa-mobile"></i></div><div class="col-md-3"><i class="fa fa-circle-o"></i></div><div class="col-md-3"><i class="fa fa-quote-left"></i></div><div class="col-md-3"><i class="fa fa-quote-right"></i></div><div class="col-md-3"><i class="fa fa-spinner"></i></div><div class="col-md-3"><i class="fa fa-circle"></i></div><div class="col-md-3"><i class="fa fa-reply"></i></div><div class="col-md-3"><i class="fa fa-github-alt"></i></div><div class="col-md-3"><i class="fa fa-folder-o"></i></div><div class="col-md-3"><i class="fa fa-folder-open-o"></i></div><div class="col-md-3"><i class="fa fa-smile-o"></i></div><div class="col-md-3"><i class="fa fa-frown-o"></i></div><div class="col-md-3"><i class="fa fa-meh-o"></i></div><div class="col-md-3"><i class="fa fa-gamepad"></i></div><div class="col-md-3"><i class="fa fa-keyboard-o"></i></div><div class="col-md-3"><i class="fa fa-flag-o"></i></div><div class="col-md-3"><i class="fa fa-flag-checkered"></i></div><div class="col-md-3"><i class="fa fa-terminal"></i></div><div class="col-md-3"><i class="fa fa-code"></i></div><div class="col-md-3"><i class="fa fa-reply-all"></i></div><div class="col-md-3"><i class="fa fa-mail-reply-all"></i></div><div class="col-md-3"><i class="fa fa-star-half-o"></i></div><div class="col-md-3"><i class="fa fa-location-arrow"></i></div><div class="col-md-3"><i class="fa fa-crop"></i></div><div class="col-md-3"><i class="fa fa-code-fork"></i></div><div class="col-md-3"><i class="fa fa-chain-broken"></i></div><div class="col-md-3"><i class="fa fa-question"></i></div><div class="col-md-3"><i class="fa fa-info"></i></div><div class="col-md-3"><i class="fa fa-exclamation"></i></div><div class="col-md-3"><i class="fa fa-superscript"></i></div><div class="col-md-3"><i class="fa fa-subscript"></i></div><div class="col-md-3"><i class="fa fa-eraser"></i></div><div class="col-md-3"><i class="fa fa-puzzle-piece"></i></div><div class="col-md-3"><i class="fa fa-microphone"></i></div><div class="col-md-3"><i class="fa fa-microphone-slash"></i></div><div class="col-md-3"><i class="fa fa-shield"></i></div><div class="col-md-3"><i class="fa fa-calendar-o"></i></div><div class="col-md-3"><i class="fa fa-fire-extinguisher"></i></div><div class="col-md-3"><i class="fa fa-rocket"></i></div><div class="col-md-3"><i class="fa fa-maxcdn"></i></div><div class="col-md-3"><i class="fa fa-chevron-circle-left"></i></div><div class="col-md-3"><i class="fa fa-chevron-circle-right"></i></div><div class="col-md-3"><i class="fa fa-chevron-circle-up"></i></div><div class="col-md-3"><i class="fa fa-chevron-circle-down"></i></div><div class="col-md-3"><i class="fa fa-html5"></i></div><div class="col-md-3"><i class="fa fa-css3"></i></div><div class="col-md-3"><i class="fa fa-anchor"></i></div><div class="col-md-3"><i class="fa fa-unlock-alt"></i></div><div class="col-md-3"><i class="fa fa-bullseye"></i></div><div class="col-md-3"><i class="fa fa-ellipsis-h"></i></div><div class="col-md-3"><i class="fa fa-ellipsis-v"></i></div><div class="col-md-3"><i class="fa fa-rss-square"></i></div><div class="col-md-3"><i class="fa fa-play-circle"></i></div><div class="col-md-3"><i class="fa fa-ticket"></i></div><div class="col-md-3"><i class="fa fa-minus-square"></i></div><div class="col-md-3"><i class="fa fa-minus-square-o"></i></div><div class="col-md-3"><i class="fa fa-level-up"></i></div><div class="col-md-3"><i class="fa fa-level-down"></i></div><div class="col-md-3"><i class="fa fa-check-square"></i></div><div class="col-md-3"><i class="fa fa-pencil-square"></i></div><div class="col-md-3"><i class="fa fa-external-link-square"></i></div><div class="col-md-3"><i class="fa fa-share-square"></i></div><div class="col-md-3"><i class="fa fa-compass"></i></div><div class="col-md-3"><i class="fa fa-caret-square-o-down"></i></div><div class="col-md-3"><i class="fa fa-caret-square-o-up"></i></div><div class="col-md-3"><i class="fa fa-caret-square-o-right"></i></div><div class="col-md-3"><i class="fa fa-eur"></i></div><div class="col-md-3"><i class="fa fa-gbp"></i></div><div class="col-md-3"><i class="fa fa-usd"></i></div><div class="col-md-3"><i class="fa fa-inr"></i></div><div class="col-md-3"><i class="fa fa-jpy"></i></div><div class="col-md-3"><i class="fa fa-rub"></i></div><div class="col-md-3"><i class="fa fa-krw"></i></div><div class="col-md-3"><i class="fa fa-btc"></i></div><div class="col-md-3"><i class="fa fa-file"></i></div><div class="col-md-3"><i class="fa fa-file-text"></i></div><div class="col-md-3"><i class="fa fa-sort-alpha-asc"></i></div><div class="col-md-3"><i class="fa fa-sort-alpha-desc"></i></div><div class="col-md-3"><i class="fa fa-sort-amount-asc"></i></div><div class="col-md-3"><i class="fa fa-sort-amount-desc"></i></div><div class="col-md-3"><i class="fa fa-sort-numeric-asc"></i></div><div class="col-md-3"><i class="fa fa-sort-numeric-desc"></i></div><div class="col-md-3"><i class="fa fa-thumbs-up"></i></div><div class="col-md-3"><i class="fa fa-thumbs-down"></i></div><div class="col-md-3"><i class="fa fa-youtube-square"></i></div><div class="col-md-3"><i class="fa fa-youtube"></i></div><div class="col-md-3"><i class="fa fa-xing"></i></div><div class="col-md-3"><i class="fa fa-xing-square"></i></div><div class="col-md-3"><i class="fa fa-youtube-play"></i></div><div class="col-md-3"><i class="fa fa-dropbox"></i></div><div class="col-md-3"><i class="fa fa-stack-overflow"></i></div><div class="col-md-3"><i class="fa fa-instagram"></i></div><div class="col-md-3"><i class="fa fa-flickr"></i></div><div class="col-md-3"><i class="fa fa-adn"></i></div><div class="col-md-3"><i class="fa fa-bitbucket"></i></div><div class="col-md-3"><i class="fa fa-bitbucket-square"></i></div><div class="col-md-3"><i class="fa fa-tumblr"></i></div><div class="col-md-3"><i class="fa fa-tumblr-square"></i></div><div class="col-md-3"><i class="fa fa-long-arrow-down"></i></div><div class="col-md-3"><i class="fa fa-long-arrow-up"></i></div><div class="col-md-3"><i class="fa fa-long-arrow-left"></i></div><div class="col-md-3"><i class="fa fa-long-arrow-right"></i></div><div class="col-md-3"><i class="fa fa-apple"></i></div><div class="col-md-3"><i class="fa fa-windows"></i></div><div class="col-md-3"><i class="fa fa-android"></i></div><div class="col-md-3"><i class="fa fa-linux"></i></div><div class="col-md-3"><i class="fa fa-dribbble"></i></div><div class="col-md-3"><i class="fa fa-skype"></i></div><div class="col-md-3"><i class="fa fa-foursquare"></i></div><div class="col-md-3"><i class="fa fa-trello"></i></div><div class="col-md-3"><i class="fa fa-female"></i></div><div class="col-md-3"><i class="fa fa-male"></i></div><div class="col-md-3"><i class="fa fa-gittip"></i></div><div class="col-md-3"><i class="fa fa-sun-o"></i></div><div class="col-md-3"><i class="fa fa-moon-o"></i></div><div class="col-md-3"><i class="fa fa-archive"></i></div><div class="col-md-3"><i class="fa fa-bug"></i></div><div class="col-md-3"><i class="fa fa-vk"></i></div><div class="col-md-3"><i class="fa fa-weibo"></i></div><div class="col-md-3"><i class="fa fa-renren"></i></div><div class="col-md-3"><i class="fa fa-pagelines"></i></div><div class="col-md-3"><i class="fa fa-stack-exchange"></i></div><div class="col-md-3"><i class="fa fa-arrow-circle-o-right"></i></div><div class="col-md-3"><i class="fa fa-arrow-circle-o-left"></i></div><div class="col-md-3"><i class="fa fa-caret-square-o-left"></i></div><div class="col-md-3"><i class="fa fa-dot-circle-o"></i></div><div class="col-md-3"><i class="fa fa-wheelchair"></i></div><div class="col-md-3"><i class="fa fa-vimeo-square"></i></div><div class="col-md-3"><i class="fa fa-try"></i></div><div class="col-md-3"><i class="fa fa-plus-square-o"></i></div>
	</div></div></div>
</div>
