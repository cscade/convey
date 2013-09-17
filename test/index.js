/*
	# Tests for `convey`.
	
	Created by Carson S. Christian <cscade@gmail.com>
*/
/*global describe:true, it:true, before:true, beforeEach:true, after:true, afterEach:true */

var server = process.env.COUCH || 'http://localhost:5984';

var assert = require('assert'),
	async = require('async'),
	nano = require('nano')(server),
	uuid = require('node-uuid'),
	Convey = require('../').Convey;

/*
	Events.
*/
describe('Events:', function () {
	var convey, db, events,
		version = '0.0.0';
	
	// Reset database before each.
	beforeEach(function (done) {
		nano.db.destroy('test-convey', function () {
			nano.db.create('test-convey', function (e) {
				if (e) return done(e);
				db = nano.db.use('test-convey');
				convey = new Convey();
				done();
			});
		});
	});
	afterEach(function (done) {
		nano.db.destroy('test-convey', done);
	});
	
	// Tests.
	it('should emit a `start` event at the beginning of a check pass', function (done) {
		events = 0;
		convey.on('start', function (details) {
			assert.equal(details.couch, server);
			assert.equal(details.version, version);
			assert.equal(details.config.toString(), '[object Object]');
			events++;
		});
		convey.check(server, version, 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(events, 1);
			done();
		});
	});
	it('should emit a `database:start` event at the beginning of examining a database', function (done) {
		events = 0;
		convey.on('database:start', function (details) {
			assert.equal(details.database, 'test-convey');
			events++;
		});
		convey.check(server, version, 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(events, 1);
			done();
		});
	});
	it('should emit a `resource:fresh` event when a resource is up to date', function (done) {
		events = 0;
		convey.on('resource:fresh', function (resource) {
			assert.equal(resource.resource, 'test');
			events++;
		});
		convey.check(server, version, 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(events, 1);
			done();
		});
	});
	it('should emit a `resource:stale` event when a resource needs updating', function (done) {
		events = 0;
		convey.on('resource:stale', function (resource) {
			assert.equal(resource.resource, 'test');
			events++;
		});
		convey.check(server, '0.0.1', 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(events, 1);
			done();
		});
	});
	it('should emit a `resource:stale` event when a resource does not need updating but check() ran with force = true', function (done) {
		events = 0;
		convey.on('resource:stale', function (resource) {
			assert.equal(resource.resource, 'test');
			assert.equal(resource.forced, true);
			events++;
		});
		convey.check(server, version, 'test/configs/empty.json', true, function (e) {
			if (e) return done(e);
			assert.equal(events, 1);
			done();
		});
	});
	it('should emit a `resource:done` event after a resource was updated', function (done) {
		events = 0;
		convey.on('resource:done', function (resource) {
			assert.equal(resource.resource, 'test');
			events++;
		});
		convey.check(server, '0.0.1', 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(events, 1);
			done();
		});
	});
	it('should emit a `database:done` event when done examining a database', function (done) {
		events = 0;
		convey.on('database:done', function (details) {
			assert.equal(details.database, 'test-convey');
			events++;
		});
		convey.check(server, version, 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(events, 1);
			done();
		});
	});
	it('should emit a `done` event at the end of a check pass', function (done) {
		events = 0;
		convey.on('done', function (info) {
			assert.equal(typeof info.duration, 'number');
			events++;
		});
		convey.check(server, version, 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(events, 1);
			done();
		});
	});
	it('should not emit a `resource:done` event if work did not need to be done', function (done) {
		events = 0;
		convey.on('resource:done', function () {
			// This event should not fire, since we are passing a version of 0.0.0
			events++;
		});
		convey.check(server, version, 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(events, 0);
			done();
		});
	});
});
/*
	Error handling.
*/
describe('Errors', function () {
	it('should be the first parameter of the callback', function (done) {
		var convey = new Convey();
		
		convey.check(server, '0.0.1', 'test/configs/missing.json', function (e) {
			assert.equal(e.name, 'Error');
			done();
		});
	});
	it('should be emitted if there is no callback', function (done) {
		var convey = new Convey();
		
		convey.on('error', function (e) {
			assert.equal(e.name, 'Error');
			done();
		});
		convey.check(server, '0.0.1', 'test/configs/missing.json');
	});
	it('should not be emitted if there is a callback', function (done) {
		var convey = new Convey(), events = 0;
		
		convey.on('error', function () {
			events++;
		});
		convey.check(server, '0.0.1', 'test/configs/missing.json', function (e) {
			assert.equal(e.name, 'Error');
			assert.equal(events, 0);
			done();
		});
	});
	describe('should be generated when configuration files', function () {
		it('are missing', function (done) {
			var convey = new Convey();
			
			convey.check(server, '0.0.1', 'test/configs/bad/missing.json', function (e) {
				assert.equal(e.name, 'Error');
				done();
			});
		});
		it('are empty', function (done) {
			var convey = new Convey();
			
			convey.check(server, '0.0.1', 'test/configs/bad/empty.json', function (e) {
				assert.equal(e.name, 'SyntaxError');
				done();
			});
		});
		it('are malformed', function (done) {
			var convey = new Convey();
			
			convey.check(server, '0.0.1', 'test/configs/bad/bad.json', function (e) {
				assert.equal(e.name, 'SyntaxError');
				done();
			});
		});
	});
	it('should be generated when version number is invalid', function (done) {
		var convey = new Convey();
		
		convey.check(server, 'foo-1.0.0', 'test/configs/single.json', function (e) {
			assert.equal(e.name, 'Error');
			assert.equal(e.message, 'a valid version number must be supplied in `semver` format');
			done();
		});
	});
});
/*
	Version document creation.
*/
describe('version awareness', function () {
	var db, convey;
	
	// Reset database only once.
	before(function (done) {
		nano.db.destroy('test-convey', function () {
			nano.db.create('test-convey', function (e) {
				db = nano.db.use('test-convey');
				done(e);
			});
		});
	});
	after(function (done) {
		nano.db.destroy('test-convey', done);
	});
	
	it('should know a new database is stale', function (done) {
		var stale = 0;
		
		convey = new Convey();
		convey.on('resource:stale', function () {
			stale++;
		});
		convey.check(server, '0.0.1', 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(stale, 1);
			done();
		});
	});
	it('should create a new version document after the first run', function (done) {
		db.get('convey-version', done);
	});
	it('should not take any action on a consecutive run with no version change', function (done) {
		var fresh = 0, stale = 0;
		
		convey = new Convey();
		convey.on('resource:fresh', function () {
			fresh++;
		});
		convey.on('resource:stale', function () {
			stale++;
		});
		convey.check(server, '0.0.1', 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(fresh, 1);
			assert.equal(stale, 0);
			done();
		});
	});
	it('should take action on a consecutive run after a version change', function (done) {
		var fresh = 0, stale = 0;
		
		convey = new Convey();
		convey.on('resource:fresh', function () {
			fresh++;
		});
		convey.on('resource:stale', function () {
			stale++;
		});
		convey.check(server, '0.0.2', 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(fresh, 0);
			assert.equal(stale, 1);
			done();
		});
	});
	it('should update the version document after the consecutive run', function (done) {
		db.get('convey-version', function (e, doc) {
			assert.equal(doc.versions.test, '0.0.2');
			done(e);
		});
	});
	it('should ignore databases with a newer convey version', function (done) {
		var fresh = 0, stale = 0;
		
		convey = new Convey();
		convey.on('resource:fresh', function () {
			fresh++;
		});
		convey.on('resource:stale', function () {
			stale++;
		});
		convey.check(server, '0.0.1', 'test/configs/empty.json', function (e) {
			if (e) return done(e);
			assert.equal(fresh, 1);
			assert.equal(stale, 0);
			done();
		});
	});
});
/*
	Design creation and updating.
*/
describe('designs', function () {
	var convey, db, firstRev;
	
	// Reset database only once.
	before(function (done) {
		nano.db.destroy('test-convey', function () {
			nano.db.create('test-convey', function (e) {
				db = nano.db.use('test-convey');
				done(e);
			});
		});
	});
	after(function (done) {
		nano.db.destroy('test-convey', done);
	});
	
	it('should be published when available', function (done) {
		convey = new Convey();
		convey.check(server, '0.0.1', 'test/configs/single.json', function (e) {
			if (e) return done(e);
			db.view('single', 'allTheThings', function (e, body) {
				if (e) return done(e);
				assert.equal(body.total_rows, 0);
				db.get('_design/single', function (e, design) {
					firstRev = design._rev;
					done(e);
				});
			});
		});
	});
	it('should not be updated if the database is already fresh', function (done) {
		convey = new Convey();
		convey.check(server, '0.0.1', 'test/configs/single.json', function (e) {
			if (e) return done(e);
			db.get('_design/single', function (e, design) {
				assert.equal(design._rev, firstRev);
				done(e);
			});
		});
	});
	it('should be updated silently if the database is not fresh', function (done) {
		convey = new Convey();
		convey.check(server, '0.0.2', 'test/configs/single.json', function (e) {
			if (e) return done(e);
			db.get('_design/single', function (e, design) {
				assert.notEqual(design._rev, firstRev);
				done(e);
			});
		});
	});
});
/*
	Document updates.
*/
describe('document updates', function () {
	var convey, db;
	
	// Reset database only once.
	before(function (done) {
		nano.db.create('test-convey-document-updates', function (e) {
			db = nano.db.use('test-convey-document-updates');
			done(e);
		});
	});
	after(function (done) {
		nano.db.destroy('test-convey-document-updates', done);
	});
	
	it('should update and/or create matching documents', function (done) {
		var updates = 0, creates = 0;
		
		convey = new Convey();
		db.insert({
			resource: 'thing'
		}, function (e, body) {
			if (e) return done(e);
			convey.on('target:done', function (info) {
				assert.equal(info.database, 'test-convey-document-updates');
				updates = updates + info.updated;
				creates = creates + info.created;
			});
			convey.check(server, '0.0.1', 'test/configs/document_updates.json', function (e) {
				if (e) return done(e);
				db.get(body.id, function (e, thing) {
					if (e) return done(e);
					assert.equal(thing.foo, 'bar');
					assert.equal(updates, 1);
					assert.equal(creates, 1);
					db.view('single', 'allTheRelatedThings', { key: thing._id, include_docs: true }, function (e, body) {
						var relatedThing;
						
						if (e) return done(e);
						relatedThing = body.rows[0].doc;
						assert.equal(relatedThing.relatesTo, thing._id);
						db.destroy(relatedThing._id, relatedThing._rev, function (e) {
							if (e) return done(e);
							db.destroy(thing._id, thing._rev, done);
						});
					});
				});
			});
		});
	});
	it('should ignore non-matching documents', function (done) {
		convey = new Convey();
		db.insert({
			resource: 'cat'
		}, function (e, body) {
			if (e) return done(e);
			convey.check(server, '0.0.2', 'test/configs/document_updates.json', function (e) {
				if (e) return done(e);
				db.get(body.id, function (e, cat) {
					if (e) return done(e);
					assert.equal(typeof cat.foo, 'undefined');
					db.destroy(cat._id, cat._rev, done);
				});
			});
		});
	});
});
/*
	Custom `convey-version` document properties.
*/
describe('custom properties on convey-version document', function () {
	var convey, db;
	
	// Reset database only once.
	before(function (done) {
		nano.db.create('test-convey-custom-properties', function (e) {
			db = nano.db.use('test-convey-custom-properties');
			done(e);
		});
	});
	after(function (done) {
		nano.db.destroy('test-convey-custom-properties', done);
	});
	
	it('should be supported', function (done) {
		convey = new Convey({
			extendDocument: {
				happyTimeCustomKey: 'woot-worthy!',
				versions: 'override this!' // `versions` is a reserved key, the next test ensures this custom key is overridden
			}
		});
		convey.check(server, '0.0.1', 'test/configs/custom_properties.json', function (e) {
			if (e) return done(e);
			db.get('convey-version', function (e, doc) {
				if (e) return done(e);
				assert.equal(doc.happyTimeCustomKey, 'woot-worthy!');
				done();
			});
		});
	});
	it('should not override built-in properties', function (done) {
		convey = new Convey();
		convey.check(server, '0.0.2', 'test/configs/custom_properties.json', function (e) {
			if (e) return done(e);
			db.get('convey-version', function (e, doc) {
				if (e) return done(e);
				assert.notEqual(doc.versions, 'override this!');
				db.destroy(doc._id, doc._rev, done);
			});
		});
	});
});
/*
	Target databases derived from views.
*/
describe('target databases derived from views', function () {
	var convey, db;
	
	// Reset database only once.
	before(function (done) {
		nano.db.create('test-convey-from-view', function (e) {
			if (e) return done(e);
			db = nano.db.use('test-convey-from-view');
			// Create two dbRef documents.
			async.series([
				function (next) {
					db.insert({
						resource: 'dbRef',
						target: 'test-convey-' + uuid.v4()
					}, function (e, body) {
						next(e, body);
					});
				},
				function (next) {
					db.insert({
						resource: 'dbRef',
						target: 'test-convey-' + uuid.v4()
					}, function (e, body) {
						next(e, body);
					});
				}
			], function (e, documents) {
				if (e) return done(e);
				// Create databases from above ref documents.
				async.forEachSeries(documents, function (doc, next) {
					db.get(doc.id, function (e, dbRef) {
						if (e) return next(e);
						nano.db.create(dbRef.target, next);
					});
				}, done);
			});
		});
	});
	after(function (done) {
		// Clean up sub-dbs.
		db.view('dbs', 'allById', function (e, body) {
			if (e) return done(e);
			async.forEachSeries(body.rows, function (row, next) {
				nano.db.destroy(row.value, next);
			}, function (e) {
				if (e) return done(e);
				nano.db.destroy('test-convey-from-view', done);
			});
		});
	});
	
	it('should apply all resource documents to all databases in the view', function (done) {
		var events = {};
		
		convey = new Convey();
		convey.on('database:start', function (info) {
			assert.equal(info.database, 'test-convey-from-view');
		}).on('resource:fresh', function (info) {
			assert.equal(info.resource, 'sub-databases');
		}).on('resource:stale', function (info) {
			assert.equal(info.resource, 'sub-databases');
		}).on('target:done', function (info) {
			assert.equal(info.database, 'test-convey-from-view');
			assert.equal(info.updated, 0);
			assert.equal(info.created, 0);
		}).on('resource:done', function (info) {
			assert.equal(info.resource, 'sub-databases');
		}).on('database:done', function (info) {
			assert.equal(info.database, 'test-convey-from-view');
		});
		convey.check(server, '0.0.1', 'test/configs/from_view.json', function (e) {
			if (e) return done(e);
			// Design is now published for getting sub-dbs by view.
			db.view('dbs', 'allById', function (e, body) {
				if (e) return done(e);
				async.forEachSeries(body.rows, function (row, next) {
					var sub = nano.db.use(row.value);
					
					// Create a foo and a bar document in each sub db.
					async.series([
						function (next) {
							sub.insert({
								resource: 'foo'
							}, next);
						},
						function (next) {
							sub.insert({
								resource: 'bar'
							}, next);
						}
					], next);
				}, function (e) {
					if (e) return done(e);
					convey.removeAllListeners(); // Drop the listeners from above.
					convey.on('target:done', function (info) {
						/*
							This event should be fired 4 times, twice for each database,
							once for each document-type.
						*/
						if (!events[info.database]) {
							events[info.database] = {
								created: info.created,
								updated: info.updated
							};
						} else {
							events[info.database].created = events[info.database].created + info.created;
							events[info.database].updated = events[info.database].updated + info.updated;
						}
					});
					convey.check(server, '0.0.1', 'test/configs/from_view_subs.json', function (e) {
						if (e) return done(e);
						// Verify documents were updated as intended.
						async.forEachSeries(body.rows, function (row, next) {
							// Each database should have seen 0 creates.
							assert.equal(events[row.value].created, 0);
							// Each database should have seen 2 edits.
							assert.equal(events[row.value].updated, 2);
							nano.db.use(row.value).list({ include_docs: true }, function (e, body) {
								if (e) return next(e);
								// Check the actual edits on each document.
								body.rows.forEach(function (row) {
									if (row.doc.resource === 'foo') {
										assert.strictEqual(row.doc.updatedFoo, true);
										assert.notEqual(row.doc.updatedBar, true);
									} else if (row.doc.resource === 'bar') {
										assert.strictEqual(row.doc.updatedBar, true);
										assert.notEqual(row.doc.updatedFoo, true);
									}
								});
								next();
							});
						}, done);
					});
				});
			});
		});
	});
});