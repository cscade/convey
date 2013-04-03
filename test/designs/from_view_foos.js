/*jshint couch:true */
// Updates to convey.
exports.convey = function (doc, next) {
	if (doc.resource !== 'foo') return next();
	// Add a property.
	doc.updatedFoo = true;
	next(doc);
};