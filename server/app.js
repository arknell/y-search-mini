/**
 * Main application file
 */

'use strict';

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _environment = require('./config/environment');

var _environment2 = _interopRequireDefault(_environment);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Setup server
var app = (0, _express2.default)();
var server = _http2.default.createServer(app);

require('./config/express').default(app);
require('./routes').default(app);
var logger = require('./components/loggers/logger');

var RecoveryManager = require('./components/recovery/RecoveryManager');
var recoveryManager = new RecoveryManager();

// Start server
function startServer() {
	app.angularFullstack = server.listen(_environment2.default.port, _environment2.default.ip, function () {
		logger.log('info', 'Express server listening on ' + _environment2.default.port + ' , in ' + app.get('env') + ' mode');

		console.log('info, is batch', process.env.batch);
		//process.env.batch = true; (just test)
		if (process.env.batch) {
			logger.log('info', 'recovery is started');
			recoveryManager.scheduling();
		}
	});
}

(0, _setImmediate3.default)(startServer);

// Expose app
exports = module.exports = app;
//# sourceMappingURL=app.js.map
