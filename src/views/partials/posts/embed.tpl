<div class="card col-6 position-relative">
	{{{ if images.length }}}
	{{{ each images }}}
	{{{ if @first }}}
	<img src="{@value}" class="card-img-top" />
	{{{ end }}}
	{{{ end }}}
	{{{ end }}}
	<div class="card-body">
		<h5 class="card-title">{title}</h5>
		<p class="card-text">{description}</p>
		<a href="{url}" class="stretched-link"></a>
	</div>

</div>