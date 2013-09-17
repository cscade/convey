# Convey

[![Build Status](https://travis-ci.org/cscade/convey.png?branch=develop)](https://travis-ci.org/cscade/convey)

Convey can greatly simplify the transition & upgrade of your app's CouchDB designs and documents when your release version changes.

A new version of your production app will often bring with it new features, new validation, document structure changes, etc. One way to handle document structure changes is to perform checks within any code that may use a given document resource, to see what "version" it is and adjust as needed. While that may work in a pinch, it rapidly gets messy - and are you sure you got every case everywhere in your app? Furthermore, how will you know when all your documents have been updated and your "upgrade" code is no longer needed?

With convey, you can define arbitrary actions to take place within your CouchDB databases when each new version of your app is deployed. These include;

* Publish new designs.
* "Upgrade" existing documents based on any criteria you define.
* Create new documents, derived from existing documents or stand-alone.

Have an advanced couchdb database structure with database names defined at runtime? Convey can handle those too.

Relax, and convey your updates the first time.

## Installation

Install convey locally and include it in your `package.json` with;

```
npm install --save convey
```

## Basic usage

Convey will publish, update, and create couch designs and userland documents based on the configuration you provide.

Convey stores a single `convey-version` document in each top-level database it is configured to watch, and will only perform actions if the version your provide has changed since it was last run. Update passes can also be "forced" (see options section below).

### A basic json configuration file

```json
{
	"myDatabase": {
		"myResource": "couch/designs/myResource"
	}
}
```

In this simple example, convey would look for a resource document at `./couch/designs/myResource`, relative to `process.cwd()`. It would take the contents of that resource document and apply it to the couch database `myDatabase`.

Let's take a look at what a simple resource document might look like.

### A basic javascript resource file

```javascript
/*
	myResource
*/

// Design to publish.
exports.design = {
	_id:"_design/someDesign",
	language: "javascript",
	views: {
		allTheThings: {
			map: function (doc) {
				if (doc.resource === 'thing') {
					emit(doc._id, null);
				}
			}
		}
	}
};

// Updates to convey.
exports.convey = function (doc, next) {
	if (doc.resource !== 'thing') return next();
	doc.foo = 'bar';
	next(doc);
};
```

This resource document contains both types of assets that convey can act on; a design, and an edit/create method. Both are optional. As you can see, the name of the resource is arbitrary, and does not define the name of the design that will be published to couch. Your design's `_id` field is still what matters.

The `design` export is a normal couch design document, and can contain anything couch knows how to deal with, for instance a `validate_doc_update` method. The design will be published if it doesn't already exist, and will be updated if it does exist.

#### exports.design

The design example above supplies an `allTheThings` view, which contains all the documents with a `resource` property of `thing`. Basic stuff. As mentioned above, these are normal couch designs. Go nuts.

#### exports.convey

The edit/create method that convey will call to check documents against your changes is defined here. This method will be passed *every document in the database*, one at a time, while convey is running a check pass. You can perform any changes you like to the document, and pass it back to convey with `next(doc)`. 

In the example above, the next release version of our app will require `thing` documents to have a `foo` property, so we add foo to each thing document, and then pass it back to convey to update in the database.

If you don't want to update a document, simply don't pass it back to `next()`, and convey will move on to the next document without changing anything.

If you only want to use convey to publish design updates and don't care about inline edit/create, just omit the export entirely. The only thing that is required is if you *do* provide a method, be sure to call next no matter if you update the document or not.

### Press Go!

Once you have a configuration file and a resource document set up, you're ready to roll.

```javascript
var Convey = require('convey').Convey;

var convey = new Convey();

convey.check('http://localhost:5984', '0.1.0', 'convey.json');
```

Using this code, convey will check each database in your configuration file, and verify that each resource in that database has already been updated to version '0.1.0'. If any resource has not been updated, convey will update the design for that resource, and run all the documents in the database against the edit/create method for that resource. Next time your app runs, convey will know that the work has already been done for this version and move on. It really is that simple.

Convey uses [node-semver](https://github.com/isaacs/node-semver) to compare all your version numbers, and decide what is newer.

For more advanced configuration and tasks, read on.

## Creating new documents

The `next` method will also accept entirely new documents to be created. This option is handy if your application design has changed in such a way that one monolithic document has been broken into sub-documents for example.

```javascript
exports.convey = function (doc, next) {
	var newDoc;
	
	if (doc.resource !== 'thing') return next();
	// Update the existing thing-type documents.
	doc.foo = 'bar';
	// Create a new document for each thing-type document as well.
	newDoc = {
		resource: 'subThing',
		parent: doc._id
	};
	next(doc, newDoc);
};
```

As with `doc`, `newDoc` is entirely optional and you can pass either, both, or none. doc will be updated if provided, and newDoc will be created if provided.

The structure of `newDoc` is completely arbitrary, and it does not need to relate to the previous document in any way.

## Advanced database structures

Some applications span a large number of databases. For instance, perhaps an application has a database for each "account" on the application, which stores all the documents related to that account.

Convey provides a simple mechanism to work with these databases at runtime, without prior knowledge of the database names at design time.

All you need to do is provide a view that returns the names of the target databases, and convey will recursively apply all the assets you specify to all the databases returned.

```json
{
	"applicationDatabase": {
		"accounts-users": {
			"view": "accounts/allById",
			"assets": "couchdb/designs/accounts/users"
		},
		"accounts-things": {
			"view": "accounts/allById",
			"assets": "couchdb/designs/accounts/things"
		}
	}
}
```

In this configuration file, the database *applicationDatabase* will be queried by the view *accounts/allById* for each resource - *accounts-users* and *accounts-things* - and the assets specified will be applied to *each database returned by the view*.

The view must be formatted such that it returns the target database name as the `value` of emit. ex.

```javascript
allById: {
	map: function (doc) {
		if (doc.resource === 'account') {
			emit(doc._id, doc.dbName);
		}
	}
}
```

The emitted `key` is not used by convey. For further examples, refer to the tests under "Target databases derived from views".

## Constructor options

```javascript
convey = new Convey(options);
```

* `extendDocument` - Object. Use this option to include any data you need to have "extended in" to the `convey-version` document.
	* A common use case is supporting databases with validate_doc_update checks that require particualar properties on all documents.

## Instance methods

### check(couch, version, config, [force], [callback])

The check method is your primary interaction point with convey. Call it whenever you want a full check of all configured databases to occur, typically on each application startup.

* `couch` - mixed. The connection information for [nano](https://github.com/dscape/nano). Anything you could normally pass to `require('nano')(...)`
* `version` - String. The semver version number to update all configured databases to.
* `config` - String. Configuration file location, relative to `process.cwd()`.
* `force` - Boolean. Force all resources in all configured databases to be "stale", regardless of their last checked version.
	* This option is useful in development, when your designs are changing often and you went to keep them up to date with each application restart.
* `callback(err)` - Function. Called when convey is done performing work, or encounters an error.

## Error handling

Convey will handle errors in two different ways, depending on how you call the `check` instance method.

If you provide a callback, your callback will receive an error object as the first parameter, and no error event will be emitted. If you do not provide a callback, the error will be emitted instead.

## Events & Logging

Convey is a good stdio citizen. It won't print anything to stdout or stderr, ever.

But never fear, it does provide rich events that let you hook into what's happening and log to your heart's content.

### Primary events

#### start(info)

Fires once, before any work is performed.

* `info.couch`: The couchdb url convey is acting against.
* `info.version`: The version string convey is currently checking your databases against.
* `info.config`: The configuration object convey is working against.

#### done(info)

Fires once, when convey is done with all resources.

* `info.duration`: The total execution time, as floor(seconds).
* `info.ms`: The total execution time, as floor(milliseconds).

### Database level events

Database level events refer to the database at the top level of your configuration document. This is also the database convey will store it's version document in.

#### database:start(info)

* `info.database`: The name of the database work is now beginning on.

#### database:done(info)

* `info.database`: The name of the database work has just completed on.

#### database:missing(info)

* `info.database`: The name of the database that did not exist in couch.

### Resource level events

Resource level events refer to the second level of your configuration file, your arbitrary resource names within a database.

#### resource:fresh(info)

Fires when a resource has already been updated to the current version.

* `info.resource`: The name of the resource currently being worked on, from the configuration file.

#### resource:stale(info)

Fires when a resource has not been updated to the current version, and updates are about to commence.

* `info.resource`: The name of the resource currently being worked on, from the configuration file.
* `info.forced`: `true` if the resource was "forced" to be stale. See methods.

#### resource:done(info)

Fires when a resource has been processed. This event will not fire unless the resource was stale.

* `info.resource`: The name of the resource currently being worked on, from the configuration file.

### Target level events

Target level events refer to the database in which edit/create operations are actually taking place.

In most use cases, the target level events will refer to the same database as the database level events do. In advanced use cases, they will refer to sub-databases defined by views. See the advanced section for more information.

#### target:done(info)

Fires when a target database has been processed. This event will not fire unless the resource was stale.

* `info.database`: The name of the target database in which edit/create operations occured.
* `info.updated`: A count of the number of documents updated.
* `info.created`: A count of the number of documents created.

## Tests

Full test coverage is provided. You'll need a reachable CouchDB, and the dev dependencies.

```
git clone git://github.com/cscade/convey.git && cd convey && npm install
COUCH=http://your-couch-url:5984 npm test
```

## License

(The MIT License)

Copyright © 2013 Carson S. Christian <cscade@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.