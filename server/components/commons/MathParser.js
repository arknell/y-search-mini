'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

exports.toAbstract = toAbstract;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 *
 * @author ChanWoo Kwon
 * date : 2018-05-14
 */

var normalizer = require('iosys-latex-eqn-converter').EqnToLatex(true);
var math = require('./math');

function getEqn(originList) {
	var eqnList = [];
	for (var i = 0; i < originList.length; i++) {
		var mathOne = originList[i];

		var split = mathOne.split('---');

		eqnList.push(split[split.length - 1]);
	}

	return eqnList;
}

function toAbstract(apiurl, originList) {

	var mathList = getEqn(originList);

	var res = [];
	var all = "";
	for (var i = 0; i < mathList.length; i++) {
		all += " " + mathList[i];
	}

	return new _promise2.default(function (resolve, reject) {
		math(apiurl, all).then(function (data) {
			return resolve(data);
		}).catch(function (err) {
			return reject(err);
		});
	});
}
//# sourceMappingURL=MathParser.js.map
