<div class="categories">
	<div class="col-sm-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-folder"></i> Categories</div>
			<div class="panel-body">
				<ul class="nav nav-pills">
					<li class='active'><a href='/admin/manage/categories/active'>Active</a></li>
					<li class=''><a href='/admin/manage/categories/disabled'>Disabled</a></li>
				</ul>

				<div class="row admin-categories">
					<ul class="col-md-12" id="entry-container">
					<!-- BEGIN categories -->
						<li data-cid="{categories.cid}" class="entry-row">
							<div class="well">
								<form class="form">
									<div class="row">
										<div class="col-sm-2 hidden-xs text-center">
											<div class="preview-box" style="
												<!-- IF categories.backgroundImage -->background-image: url({categories.backgroundImage});<!-- ENDIF categories.backgroundImage -->
												<!-- IF categories.bgColor -->background-color: {categories.bgColor};<!-- ENDIF categories.bgColor -->
												color: {categories.color};
												background-size:cover;
											">
												<div class="icon">
													<i data-name="icon" value="{categories.icon}" class="fa {categories.icon} fa-2x"></i>
												</div>
											</div><br />
											<button type="button" data-name="image" data-value="{categories.image}" class="btn btn-default upload-button"><i class="fa fa-upload"></i> Image</button>
											<!-- IF categories.image -->
											<br/>
											<small class="pointer delete-image"><i data-name="icon" value="fa-times" class="fa fa-times"></i> Delete Image</small>
											<!-- ENDIF categories.image -->
										</div>
										<div class="col-sm-10">
											<div class="pull-right text-right">
												<div class="form-group">
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
															<li><a href="#" class="purge"><i class="fa fa-eraser"></i> Purge</a></li>
														</ul>


														<button class="btn btn-primary save">Save</button>

													</div>
												</div>
											</div>
											<h3 data-edit-target="#cid-{categories.cid}-name"><span>{categories.name}</span> <small><i class="fa fa-edit"></i></small></h3>
											<input id="cid-{categories.cid}-name" type="text" class="form-control hide" placeholder="Category Name" data-name="name" value="{categories.name}" />
											<h4 data-edit-target="#cid-{categories.cid}-description"><span>{categories.description}</span> <small><i class="fa fa-edit"></i></small></h4>
											<input id="cid-{categories.cid}-description" data-name="description" placeholder="Category Description" value="{categories.description}" class="form-control category_description input-sm description hide"></input>

											<fieldset>
												<div class="col-sm-4 col-xs-12">
													<div class="form-group">
														<label for="cid-{categories.cid}-parentCid">Parent Category</label>
														<!-- IF categories.parent.name -->
														<div class="btn-group">
															<button type="button" class="btn btn-default" data-action="setParent" data-parentCid="{categories.parent.cid}"><i class="fa {categories.parent.icon}"></i> {categories.parent.name}</button>
															<button type="button" class="btn btn-warning" data-action="removeParent" data-parentCid="{categories.parent.cid}"><i class="fa fa-times"></i></button>
														</div>
														<!-- ELSE -->
														<button type="button" class="btn btn-default form-control" data-action="setParent"><i class="fa fa-sitemap"></i> (None)</button>
														<!-- ENDIF categories.parent.name -->
													</div>
												</div>
											</fieldset>
											<fieldset>
												<div class="col-sm-4 col-xs-12">
													<div class="form-group">
														<label for="cid-{categories.cid}-bgColor">Background Colour</label>
														<input id="cid-{categories.cid}-bgColor" placeholder="#0059b2" data-name="bgColor" value="{categories.bgColor}" class="form-control category_bgColor" />
													</div>
												</div>
												<div class="col-sm-4 col-xs-12">
													<div class="form-group">
														<label for="cid-{categories.cid}-color">Text Colour</label>
														<input id="cid-{categories.cid}-color" placeholder="#fff" data-name="color" value="{categories.color}" class="form-control category_color" />
													</div>
												</div>
												<div class="col-sm-4 col-xs-12">
													<div class="form-group">
														<label for="cid-{categories.cid}-imageClass">Image Class</label>
															<select id="cid-{categories.cid}-imageClass" class="form-control" data-name="imageClass" data-value="{categories.imageClass}">
															<option value="auto">auto</option>
															<option value="cover">cover</option>
															<option value="contain">contain</option>
														</select>
													</div>
												</div>
												<div class="col-sm-4 col-xs-12">
													<div class="form-group">
														<label for="cid-{categories.cid}-class">Custom Class</label>
														<input id="cid-{categories.cid}-class" type="text" class="form-control" placeholder="col-md-6 col-xs-6" data-name="class" value="{categories.class}" />
													</div>
												</div>
												<div class="col-sm-4 col-xs-12">
													<div class="form-group">
														<label for="cid-{categories.cid}-numRecentReplies"># of Recent Replies Displayed</label>
														<input id="cid-{categories.cid}-numRecentReplies" type="text" class="form-control" placeholder="2" data-name="numRecentReplies" value="{categories.numRecentReplies}" />
													</div>
												</div>
												<div class="col-sm-4 col-xs-12">
													<div class="form-group">
														<label for="cid-{categories.cid}-link">External Link</label>
														<input id="cid-{categories.cid}-link" type="text" class="form-control" placeholder="http://domain.com" data-name="link" value="{categories.link}" />
													</div>
												</div>
											</fieldset>

											<input type="hidden" data-name="order" data-value="{categories.order}"></input>
										</div>
									</div>
								</form>
							</div>
						</li>
					<!-- END categories -->
					</ul>
				</div>				
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Categories Control Panel</div>
			<div class="panel-body">
				<button class="btn btn-primary" id="addNew">Create New Category</button>
				<button class="btn btn-default" id="revertChanges">Revert Changes</button>
			</div>
		</div>
	</div>
	
	<span class="hidden" id="csrf" data-csrf="{csrf}"></span>

	<!-- IMPORT admin/partials/categories/new.tpl -->
	<!-- IMPORT admin/partials/categories/permissions.tpl -->
	<!-- IMPORT admin/partials/categories/setParent.tpl -->
	<div id="icons" style="display:none;">
		<div class="icon-container">
			<div class="row fa-icons">
				<i class="fa fa-doesnt-exist"></i>
				<!-- IMPORT admin/partials/fontawesome.tpl -->
			</div>
		</div>
	</div>
</div>