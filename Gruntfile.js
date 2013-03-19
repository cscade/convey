/*
	# Gruntfile
*/

module.exports = function (grunt) {
	grunt.initConfig({
		// Code quality.
		jshint: {
			options: {
				eqeqeq: true,
				immed: true,
				latedef: true,
				newcap: true,
				noarg: true,
				undef: true,
				// Relax.
				boss: true,
				smarttabs: true,
				node: true
			},
			grunt: [
				'Gruntfile.js'
			],
			convey: [
				'index.js'
			]
		}
	});
	
	// Dependecies.
	grunt.loadNpmTasks('grunt-contrib-jshint');
	
	// Tasks.
	grunt.registerTask('default', ['jshint:grunt', 'jshint:convey']);
};
