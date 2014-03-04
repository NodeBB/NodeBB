<ol class="breadcrumb">
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="{relative_path}/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
	</li>
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="{relative_path}/reset" itemprop="url"><span itemprop="title">[[reset_password:reset_password]]</span></a>
	</li>
	<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<span itemprop="title">[[reset_password:update_password]]</span>
	</li>
</ol>


<div class="well">
	<div class="alert alert-success" id="success" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>[[reset_password:password_changed.title]]</strong>
		<p>[[reset_password:password_changed.message]]</p>
	</div>
	<div class="alert alert-warning" id="notice" style="display:none">
		<strong></strong>
		<p></p>
	</div>
	<div class="alert alert-danger" id="error" style="display:none">
		<strong>[[reset_password:wrong_reset_code.title]]</strong>
		<p>[[reset_password:wrong_reset_code.message]]</p>
	</div>
	<form onsubmit="return false;" id="reset-form">
		<label for="password">[[reset_password:new_password]]</label>
		<input class="form-control input-lg" type="password" placeholder="[[reset_password:new_password]]" id="password" /><br />
		<label for="repeat">[[reset_password:repeat_password]]</label>
		<input class="form-control input-lg" type="password" placeholder="[[reset_password:repeat_password]]" id="repeat" /><br />
		<button class="btn btn-primary btn-lg btn-block" id="reset" type="submit">[[reset_password:reset_password]]</button>
	</form>
</div>
<input type="hidden" template-variable="reset_code" value="{reset_code}" />
