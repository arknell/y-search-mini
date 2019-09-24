'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 색인어 추출기 library 사용을 위한 유틸
 * 색인어 추출기 라이브러리
 * Java service로 변경 (2019.01.03)
 *
 * @author Saebyeok Lee
 * @author Chanwoo Kwon
 */
var stopword = require('./stopword')();
var _ = require('lodash');
var request = require('request');
/**
 * @param str      // 색인어를 추출할 입력 문자열  String
 */
module.exports = function (apiurl, str) {
	"use strict";

	return new _promise2.default(function (resolve, reject) {
		request({
			uri: apiurl + '/token.dox',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'charset': 'utf-8'
			},
			json: { text: str }
		}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				if (body.result == 'success') {
					return resolve(_.difference(body.data, stopword));
					//return resolve(body.data)
				} else {
					return reject({ message: body.message, errMessage: body.errMessage });
				}
			}
		});
	});
};
//# sourceMappingURL=ne.js.map
