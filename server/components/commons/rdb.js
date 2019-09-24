'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 *
 * @author ChanWoo Kwon
 * date : 2019-01-04
 */
var request = require('request');
/**
 * @param str      // 색인어를 추출할 입력 문자열  String
 */
module.exports = {
	/**
  * 특정 문항 정보를 RDB에서 읽어옴
  * @param opts
  *  dbo : RDB에서 DBO 이름
  *  keys : 정보를 가져올 문항의 Unique key 리스트 (여러개 문항 가능)
  *  apiurl: 정보를 가져올 api 서비스 url,
  *  name: db kind (quizdoc, quizhwp, etc)
  * @returns {Promise}
  */
	getItem: function getItem(opts) {
		"use strict";

		return new _promise2.default(function (resolve, reject) {
			request({
				uri: opts.apiurl + '/item.dox',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'charset': 'utf-8'
				},
				json: { dbo: opts.dbo, keys: opts.keys, name: opts.name }
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if (body.result == 'success') {
						//return resolve(_.difference(body.data, stopword))
						return resolve(body.data);
					} else {
						return reject({ message: body.message, errMessage: body.errMessage });
					}
				}
			});
		});
	},
	/**
  * 여러개 문항 정보를 RDB에서 읽어옴
  * @param opts
  *  dbo : RDB에서 DBO 이름
  *  order : 오더링 key
  *  recentUpdate : 최근 업데이트
  *  firstIndex: 가져올 문항들의 첫번째 인덱스 (row_number 기반)
  *  lastIndex: 가져올 문항들의 마지막 인덱스 (row_number 기반)
  *  apiurl : 가져올 api 서비스 url
  *  name: db kind (quizdoc, quizhwp, etc)
  * @returns {Promise}
  */
	getBatch: function getBatch(opts) {
		"use strict";

		return new _promise2.default(function (resolve, reject) {
			request({
				uri: opts.apiurl + '/batch.dox',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'charset': 'utf-8'
				},
				json: { dbo: opts.dbo, order: opts.order, recentUpdate: opts.recentUpdate, firstIndex: opts.firstIndex, lastIndex: opts.lastIndex, name: opts.name }
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if (body.result == 'success') {
						//return resolve(_.difference(body.data, stopword))
						return resolve(body.data);
					} else {
						return reject({ message: body.message, errMessage: body.errMessage });
					}
				}
			});
		});
	},

	getRecovery: function getRecovery(opts) {
		"use strict";
		//console.log(opts);

		return new _promise2.default(function (resolve, reject) {
			request({
				uri: opts.apiurl + '/recovery.dox',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'charset': 'utf-8'
				},
				json: { dbo: opts.dbo, kind: opts.kind }
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if (body.result == 'success') {
						//return resolve(_.difference(body.data, stopword))
						return resolve(body.data);
					} else {
						return reject({ message: body.message, errMessage: body.errMessage });
					}
				}
			});
		});
	},

	getRecoveryByOrderKey: function getRecoveryByOrderKey(opts) {
		"use strict";
		//console.log(opts);

		return new _promise2.default(function (resolve, reject) {
			request({
				uri: opts.apiurl + '/recovery/order.dox',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'charset': 'utf-8'
				},
				json: { dbo: opts.dbo, kind: opts.kind }
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if (body.result == 'success') {
						//return resolve(_.difference(body.data, stopword))
						return resolve(body.data);
					} else {
						return reject({ message: body.message, errMessage: body.errMessage });
					}
				}
			});
		});
	},

	updateRecovery: function updateRecovery(opts) {
		"use strict";

		return new _promise2.default(function (resolve, reject) {
			request({
				uri: opts.apiurl + '/recovery/update.dox',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'charset': 'utf-8'
				},
				json: { dbo: opts.dbo, keys: opts.keys }
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if (body.result == 'success') {
						//return resolve(_.difference(body.data, stopword))
						return resolve(body.data);
					} else {
						return reject({ message: body.message, errMessage: body.errMessage });
					}
				}
			});
		});
	}
};
//# sourceMappingURL=rdb.js.map
