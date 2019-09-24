/**
 * Created by ChanWoo Kwon on 2017-03-17.
 * file 및 server console에 로그를 남김
 */
'use strict';

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var fs = require('fs');
var path = require('path');
var logger = exports;
var appDir = path.dirname(require.main.filename);
var access = fs.createWriteStream(appDir + '/node.access.log', { flags: 'a' }),
    error = fs.createWriteStream(appDir + '/node.error.log', { flags: 'a' });
logger.debugLevel = 'warn';
logger.log = function (level, message) {
	var levels = ['error', 'warn', 'info'];

	var date = new Date();
	var dateStr = "[" + date.getFullYear() + "-" + pad(date.getMonth(), 2) + "-" + pad(date.getDate(), 2) + " " + pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2) + ":" + pad(date.getSeconds(), 2) + "]";

	if (typeof message !== 'string') {
		message = (0, _stringify2.default)(message);
	}

	if (levels.indexOf(level) >= levels.indexOf(logger.debugLevel)) {
		access.write(dateStr + " - " + message + "\n");
	} else {
		//error
		error.write(dateStr + " - " + message + "\n");
	}

	console.log(level + ': ' + message);
};

//숫자를 width 자리로 만들어줌 (width = 2, '8' -> '08' | width = 4, '4' -> '0004')
function pad(n, width) {
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}
//# sourceMappingURL=logger.js.map
