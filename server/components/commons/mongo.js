/**
 * mongo db 인터페이스
 * ldb 모듈로부터 수정
 * 1. 커넥션을 관리
 * 2. 기본 기능 (open, close)
 * @author ChanWoo Kwon
 * date : 2017-08-14
 */
"use strict";

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _ = require('lodash'),
    path = require('path'),
    env = require('../../config/environment');

var MongodbClient = require('mongodb').MongoClient;
var dbName = 'search';
var url = "mongodb://" + env.idbId + ":" + env.idbPw + "@" + env.idbUrl + ":" + env.idbPort + "/" + dbName;

var conn = []; // 현재 관리 중인 커넥션

module.exports = {

	/**
  * DB 열기 및 collection check
  * @param module {string} connection 모듈당 분할
  * @param name {string} check 할 collection 이름
  * @param doMake {boolean} 없을 경우 collection 제작 여부 default : true
  */
	open: function open(module, name, doMake) {
		doMake = doMake || true;
		return new _promise2.default(function (resolve, reject) {
			var done = function done(client) {
				return client.db(dbName).collection(name, function (err, collection) {
					if (err) {
						//check error
						console.log(err);
						return reject(err);
					}

					if (!collection) {
						if (doMake == true) {
							return client.createCollection(name).then(function () {
								return resolve(collection);
							}).catch(function () {
								return reject(err);
							});
						} else {
							return resolve(null);
						}
					} else {
						return resolve(collection);
					}
				});
			};

			if (conn[module] == null) {
				return MongodbClient.connect(url, function (err, client) {
					if (err) return reject(err);

					conn[module] = client;
					return done(client);
				});
			} else {
				return done(conn[module]);
			}
		});
	},
	// db 닫기
	close: function close() {
		if (conn != null) {
			conn.close();
			conn = null;
		}
	},
	// collection 삭제, drop
	destroy: function destroy(module, name) {
		// 삭제 (데이터 전체 삭제)
		console.log(name);
		return new _promise2.default(function (resolve, reject) {
			var done = function done(client) {
				return client.db(dbName).collection(name, function (err, collection) {
					if (err) {
						//check error
						console.log(err);
						return reject(err);
					}

					if (!collection) {
						return resolve();
					} else {
						collection.drop(function () {
							return resolve();
						});
					}
				});
			};

			if (conn[module] == null) {
				return MongodbClient.connect(url, function (err, client) {
					if (err) return reject(err);

					conn[module] = client;
					return done(client);
				});
			} else {
				return done(conn[module]);
			}
		});
	}
};
//# sourceMappingURL=mongo.js.map
