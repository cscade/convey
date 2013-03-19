**WIP! This module is being ported over from production code, and is not yet functional. Don't use quite yet.**

# Convey

[![Build Status](https://travis-ci.org/cscade/convey.png?branch=develop)](https://travis-ci.org/cscade/convey)

The purpose of `convey` is to automate the transition of your app's CouchDB designs and existing documents when your release version changes. Often, a new version of your app will bring with it new features, new validation, document structure changes, etc. One way to handle document structure changes is to perform checks within any code that may use a given document resource, to see what version it is and adjust as needed. While that may work, it rapidly gets messy - and are you sure you got every case everywhere in your app? Furthermore, how will you know when all your documents have been updated and the "upgrade" code is no longer needed?

With convey, you can define arbitrary actions to take place within your CouchDB databases when each new version of your app starts up for the first time in production. This includes document updates, document creation, design publishing, and even the ability to publish to/modify documents in sub-databases defined by views.

Relax, and convey your updates the first time.

## Installation

```
npm install convey
```

## Usage

```javascript
var Convey = require('convey').Convey;
```

## Tests

Full test coverage is provided. You'll need a reachable CouchDB, and the dev dependencies.

```
git clone git://github.com/cscade/convey.git && cd convey && npm install
COUCH=http://your-couch-url:5984 npm test
```

## License

(The MIT License)

Copyright (c) 2013 Carson Christian <cscade@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
