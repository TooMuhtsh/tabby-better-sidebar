# Third-party notices

Parts of this plugin (notably the initial profile tree component) are adapted
from [Eugeny/tabby](https://github.com/Eugeny/tabby), used under the MIT
License:

```
MIT License

Copyright (c) Eugene Pankov and Tabby contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## DOMPurify

The custom SVG icon import feature is sanitized using
[DOMPurify](https://github.com/cure53/DOMPurify) (Cure53 and other
contributors), dual-licensed under the Apache License 2.0 and the Mozilla
Public License 2.0. See the `dompurify` npm package (embedded in this
plugin's bundle) for full license text.

## Iconify icon sets (Material Design Icons, Tabler Icons)

The icon picker's search results are sourced, in addition to Font Awesome
(via Tabby's own `icons.json`, see below), from two icon sets distributed in
[Iconify](https://iconify.design) JSON format as the `@iconify-json/mdi` and
`@iconify-json/tabler` npm packages, embedded as static data in this plugin:

- **Material Design Icons** (https://github.com/Templarian/MaterialDesign),
  licensed under the Apache License 2.0.
- **Tabler Icons** (https://github.com/tabler/tabler-icons), licensed under
  the MIT License.

## Font Awesome icon names (via Tabby)

`src/icons.json` is extracted from Tabby's own `tabby-core` source
(`icons.json`, not published in the npm package — see this plugin's
`tabby_sidebar_roadmap.md`), itself derived from
[Font Awesome Free](https://fontawesome.com) (icons: CC BY 4.0, code: MIT).
This plugin only stores/searches Font Awesome *class name strings* (e.g.
`"fas fa-star"`) that Tabby's own already-bundled Font Awesome font/CSS
renders — no Font Awesome font files or icon glyphs are themselves
redistributed by this plugin.
