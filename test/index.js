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
	Configuration file handling.
*/
describe('configure()', function () {
	it('should load a configuration file from disk', function () {
		var good = new Convey();
		
		good.configure(path.join(__dirname, 'configs/single.json'));
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
	
	// Test db setup and tear down.
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
		nano.db.destroy('test-convey');
		done();
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
		convey.check(server, version, path.join(__dirname, 'configs/single.json'));
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
		convey.check(server, version, path.join(__dirname, 'configs/single.json'));
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
		convey.check(server, version, path.join(__dirname, 'configs/single.json'));
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
		convey.check(server, version, path.join(__dirname, 'configs/single.json'));
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
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/single.json'));
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
		convey.check(server, '0.0.1', path.join(__dirname, 'configs/single.json'));
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
		convey.check(server, version, path.join(__dirname, 'configs/single.json'));
	});
	it('should emit a `done` event at the end of a check pass', function (done) {
		convey.on('done', done);
		convey.check(server, version, path.join(__dirname, 'configs/single.json'));
	});
	it('should not emit a `resource:updated` event if work did not need to be done', function (done) {
		events = 0;
		convey.on('resource:updated', function (resource) {
			// This event should not fire, since we are passing a version of 0.0.0
			events++;
		});
		convey.on('done', function () {
			assert.equal(events, 0);
			done();
		});
		convey.check(server, version, path.join(__dirname, 'configs/single.json'));
	});
});
/*
	Multiple Database updating (from a view).
*/
describe('multiple database updating', function () {
	
});
