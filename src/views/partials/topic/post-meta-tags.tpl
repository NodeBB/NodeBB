<meta itemprop="datePublished" content="{./timestampISO}">
{{{ if ./editedISO }}}<meta itemprop="dateModified" content="{./editedISO}">{{{ end }}}
<div itemprop="author" itemscope itemtype="https://schema.org/Person">
	<meta itemprop="name" content="{{txDisplayname(./user)}}">
	{{{ if ./user.userslug }}}<meta itemprop="url" content="{config.relative_path}/user/{./user.userslug}">{{{ end }}}
	{{{ if ./user.picture }}}<meta itemprop="image" content="{./user.picture}">{{{ end }}}
</div>