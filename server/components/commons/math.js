'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 수식을 색인하기 위한 모듈
 * 
 * @author ChanWoo Kwon
 * date : 2019-04-23
 */
var _ = require('lodash');
var request = require('request');
/**
 * @param str      // 색인어를 추출할 입력 문자열  String
 */
module.exports = function (apiurl, str) {
	"use strict";

	return new _promise2.default(function (resolve, reject) {
		request({
			uri: apiurl + '/converter/exp.elgx',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'charset': 'utf-8'
			},
			json: { text: str, before: true }
		}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				if (body.result == 'success') {
					//console.log(body.data);
					return resolve(body.data);
				} else {
					return reject({ message: body.message, errMessage: body.errMessage });
				}
			}
		});
	});
};
//# sourceMappingURL=math.js.map
