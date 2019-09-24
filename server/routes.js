/**
 * Main application routes
 * Routing 전달 파일
 * 각 요청에 따라 api 폴더 아래 있는 파일로 전달
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (app) {
	// Insert routes below
	app.use('/api/indexings', require('./api/indexing')); // ./api/indexing/index.js   ex) http://dev1.teams.kr:8060/api/indexing
	app.use('/api/searchs', require('./api/search'));
	app.use('/api/cores', require('./api/core'));
	app.use('/api/users', require('./api/user'));
	app.use('/api/words', require('./api/word'));
	app.use('/api/similarity', require('./api/similarity'));
	// All undefined asset or api routes should return a 404
	app.route('/:url(api|auth|components|app|bower_components|assets)/*').get(_errors2.default[404]);

	// All other routes should redirect to the index.html
	app.route('/*').get(function (req, res) {
		res.sendFile(_path2.default.resolve(app.get('appPath') + '/index.html'));
	});
};

var _errors = require('./components/errors');

var _errors2 = _interopRequireDefault(_errors);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=routes.js.map
