/*jshint couch:true */
// Updates to convey.
exports.convey = function (doc, next) {
	if (doc.resource !== 'bar') return next();
	// Add a property.
	doc.updatedBar = true;
	next(doc);
};