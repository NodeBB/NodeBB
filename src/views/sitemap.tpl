<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    {{{ if pages }}}
    <sitemap>
        <loc data-tpl-lint-ignore>{url}/sitemap/pages.xml</loc>
    </sitemap>
    {{{ end }}}
    {{{ if categories }}}
    <sitemap>
        <loc data-tpl-lint-ignore>{url}/sitemap/categories.xml</loc>
    </sitemap>
    {{{ end }}}
    {{{ each topics }}}
    <sitemap>
        <loc data-tpl-lint-ignore>{url}/sitemap/topics.{@value}.xml</loc>
    </sitemap>
    {{{ end }}}
</sitemapindex>