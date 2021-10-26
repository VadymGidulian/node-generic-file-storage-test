'use strict';

module.exports = {
	collectCoverage:     true,
	collectCoverageFrom: ['<rootDir>/dist/**/*.js'],
	testEnvironment:     'node',
	testMatch:           ['<rootDir>/test/**/*.test.js'],
	verbose:             true
};
