/*jshint couch:true */
// Design to publish.
exports.design = {
	_id:"_design/dbs",
	language: "javascript",
	views: {
		allById: {
			map: function (doc) {
				if (doc.resource === 'dbRef') {
					emit(doc._id, doc.target);
				}
			}
		}
	}
};