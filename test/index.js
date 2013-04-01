/*
	# Tests for `convey`.
	
	Created by Carson S. Christian <cscade@gmail.com>
*/
/*global describe:true, it:true, beforeEach:true, afterEach:true */

var server = process.env.COUCH || 'http://localhost:5984';

var assert = require('assert'),
	nano = require('nano')(server),
	path = require('path'),
	Convey = require('../').Convey;

/*
	Convenience.
*/
var dbRef = function () {
	return nano.db.use('test-convey');
};

/*
	Configuration file handling.
*/
describe('configure()', function () {
	it('should load a configuration file from disk', function () {
		var good = new Convey();
		
		good.configure(path.join(__dirname, 'configs/empty.json'));
	});
	it('should emit an error when a bad configuration file is specified', function () {
		var bad = new Convey();
		
		bad.on('error', function (e) {
			assert(e.message);
		});
		bad.configure(path.join(__dirname, 'configs/bad.json'));
	});
	it('should emit an error when a missing configuration file is specified', function () {
		var missing = new Convey();
		
		missing.on('error', function (e) {
			assert(e.message);
		});
		missing.configure(path.join(__dirname, 'missing.json'));
	});
});
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
				db = dbRef();
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
		convey.on('done', function () {
			assert.equal(events, 1);
			done();
		});
		convey.check(server, version, path.join(__dirname, 'configs/empty.json'));
	});
	it('should emit a `database:start` event at the beginning of examining a database', function (done) {
		events = 0;
		convey.on('database:start', function (details) {
			assert.equal(details.database, 'test-convey');
			assert.equal(details.resources.toString(), '[object Object]');
			events++;
		});
		convey.on('done', function () {
			assert.equal(events, 1);
			done();
		});
		convey.check(server, version, path.join(__dirname, 'configs/empty.json'));
	});
	it('should emit a `untouched` event when a database has never been updated', function (done) {
		events = 0;
		convey.on('untouched', function (message) {
			assert.equal(message, 'test-convey');
			events++;
		});
		convey.on('done', function () {
			assert.equal(events, 1);
			done();
		});
		convey.check(server, version, path.join(__dirname, 'configs/empty.json'));
	});
	it('should emit a `resource:fresh` event when a resource is up to date', function (done) {
		events = 0;
		convey.on('resource:fresh', function (resource) {
			assert.equal(resource, 'test');
			events++;
		});
		convey.on('done', function () {
			assert.equal(events, 1);
			done();
		});
		convey.check(server, version, path.join(__dirname, 'configs/empty.json'));
	});
	it('should emit a `resource:stale` event when a resource needs updating', function (done) {
		events = 0;
		convey.on('resource:stale', function (resource) {
			assert.equal(resource, 'test');
			events++;
		});
		convey.on('done', function () {
			assert.equal(events, 1);
			done();
		});
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/empty.json'));
	});
	it('should emit a `resource:updated` event after a resource was updated', function (done) {
		events = 0;
		convey.on('resource:updated', function (resource) {
			assert.equal(resource, 'test');
			events++;
		});
		convey.on('done', function () {
			assert.equal(events, 1);
			done();
		});
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/empty.json'));
	});
	it('should emit a `database:done` event when done examining a database', function (done) {
		events = 0;
		convey.on('database:done', function (details) {
			assert.equal(details.database, 'test-convey');
			events++;
		});
		convey.on('done', function () {
			assert.equal(events, 1);
			done();
		});
		convey.check(server, version, path.join(__dirname, 'configs/empty.json'));
	});
	it('should emit a `done` event at the end of a check pass', function (done) {
		convey.on('done', done);
		convey.check(server, version, path.join(__dirname, 'configs/empty.json'));
	});
	it('should not emit a `resource:updated` event if work did not need to be done', function (done) {
		events = 0;
		convey.on('resource:updated', function () {
			// This event should not fire, since we are passing a version of 0.0.0
			events++;
		});
		convey.on('done', function () {
			assert.equal(events, 0);
			done();
		});
		convey.check(server, version, path.join(__dirname, 'configs/empty.json'));
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
				db = dbRef();
				done(e);
			});
		});
	});
	after(function (done) {
		nano.db.destroy('test-convey', done);
	});
	
	it('should know a new database was untouched', function (done) {
		var untouched = 0, stale = 0;
		
		convey = new Convey();
		convey.on('untouched', function () {
			untouched++;
		});
		convey.on('resource:stale', function () {
			stale++;
		});
		convey.on('done', function () {
			assert.equal(untouched, 1);
			assert.equal(stale, 1);
			done();
		});
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/empty.json'));
	});
	it('should create a new version document after the first run', function (done) {
		db.get('convey-version', done);
	});
	it('should not take any action on a consecutive run with no version change', function (done) {
		var untouched = 0, fresh = 0, stale = 0;
		
		convey = new Convey();
		convey.on('untouched', function () {
			untouched++;
		});
		convey.on('resource:fresh', function () {
			fresh++;
		});
		convey.on('resource:stale', function () {
			stale++;
		});
		convey.on('done', function () {
			assert.equal(untouched, 0);
			assert.equal(fresh, 1);
			assert.equal(stale, 0);
			done();
		});
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/empty.json'));
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
		convey.on('done', function () {
			assert.equal(fresh, 0);
			assert.equal(stale, 1);
			done();
		});
		convey.check(server, '0.0.2', path.join(__dirname, 'configs/empty.json'));
	});
	it('should update the version document after the consecutive run', function (done) {
		db.get('convey-version', function (e, doc) {
			assert.equal(doc.versions.test, '0.0.2');
			done(e);
		});
	});
	it('should ignore databases with a newer convey version', function (done) {
		var untouched = 0, fresh = 0, stale = 0;
		
		convey = new Convey();
		convey.on('untouched', function () {
			untouched++;
		});
		convey.on('resource:fresh', function () {
			fresh++;
		});
		convey.on('resource:stale', function () {
			stale++;
		});
		convey.on('done', function () {
			assert.equal(untouched, 0);
			assert.equal(fresh, 1);
			assert.equal(stale, 0);
			done();
		});
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/empty.json'));
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
				db = dbRef();
				done(e);
			});
		});
	});
	after(function (done) {
		nano.db.destroy('test-convey', done);
	});
	
	it('should be published when available', function (done) {
		convey = new Convey();
		convey.on('done', function () {
			db.view('single', 'allTheThings', function (e, body) {
				if (e) return done(e);
				assert.equal(body.total_rows, 0);
				db.get('_design/single', function (e, design) {
					firstRev = design._rev;
					done(e);
				});
			});
		});
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/single.json'));
	});
	it('should not be updated if the database is already fresh', function (done) {
		convey = new Convey();
		convey.on('done', function () {
			db.get('_design/single', function (e, design) {
				assert.equal(design._rev, firstRev);
				done(e);
			});
		});
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/single.json'));
	});
	it('should be updated silently if the database is not fresh', function (done) {
		convey = new Convey();
		convey.on('done', function () {
			db.get('_design/single', function (e, design) {
				assert.notEqual(design._rev, firstRev);
				done(e);
			});
		});
		convey.check(server, '0.0.2', path.join(__dirname, 'configs/single.json'));
	});
});
/*
	Document updates.
*/
describe('document updates', function () {
	it('should update matching documents');
	it('should ignore non-matching documents');
});
/*
	Document creation.
*/
describe('document creation', function () {
	it('should create new documents as instructed');
});