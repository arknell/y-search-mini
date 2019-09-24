/**
 * indexing 관련 요청(indexingOne, remove, modify) 큐 관리
 * 순차적 처리
 * Created by ChanWoo Kwon on 2017-04-26.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.indexingMath = exports.modify = exports.remove = exports.indexingOneWithContent = exports.indexingOne = undefined;

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _ = require('lodash');
var dbcopy = require('../indexers/dbcopy');
var indexer = require('../indexers/indexer');
var logger = require('../loggers/logger');
var mongodb = require('../commons/mongo');

var indexingOne = exports.indexingOne = "indexingOne";
var indexingOneWithContent = exports.indexingOneWithContent = "indexingOneWithContent";
var remove = exports.remove = "remove";
var modify = exports.modify = "modify";
var indexingMath = exports.indexingMath = "indexingMath";

var util = require('../commons/utils');

var seeker = exports;

// 요청 queue 저장 element : {"keys" : [문항 코드], "name" : [데이터베이스 이름]}
var datas = [];
var nowWorking = false;

/**
 * 외부 사용 함수 (indexing.controller.js 의weee indexingOne, remove, modify 에서 사용)
 * @param input 사용할 요청 {"req":{"keys":[문항 코드],"name":[데이터베이스 이름]},"action":[취할 행동] , "copied" : [복사 여부]}
 * @param done 콜백
 */
seeker.send = function (input, done) {
	input.done = done;
	datas.push(input);
	if (!nowWorking) {
		nowWorking = true;
		workElement();
	}
	//done(input);
};

var workElement = function workElement() {
	var doWork = function doWork() {
		if (datas.length == 0) {
			nowWorking = false;
			return;
		}

		var data = datas.shift();

		var action = data.action;

		var callback = function callback(err) {
			if (data.done) data.done(err);

			var updateLastOrderKey = function updateLastOrderKey() {
				var docDb = null;
				var dbName = data.req.name.trim();

				mongodb.open('indexing', dbName, false).then(function (collection) {
					docDb = collection;
					return mongodb.open('indexing', 'coredb', false);
				}).then(function (collection) {
					return collection.findOne({ _id: dbName }, function (err, doc) {
						if (err || doc == undefined) {
							return doWork();
						}

						var metaInfo = doc;
						return docDb.findOne({ _id: data.req.keys[0] }, function (err, doc) {
							if (err || doc == undefined) {
								return doWork();
							}

							var column = metaInfo.index.columns.find(function (o) {
								return o.type === 'order';
							});

							if (column == null) return doWork();

							metaInfo.lastOrderKeyValue = doc[column.name];
							metaInfo.nowIndexingOne = false;

							return collection.save(metaInfo, function (err) {
								return doWork();
							});
						});
					});
				}).catch(function (err) {
					return doWork();
				});
			};

			return updateLastOrderKey();
		};

		try {
			switch (action) {
				case indexingOne:
					return doIndexingOne(data.req, data.copied, callback);
				case remove:
					return doRemove(data.req, callback);
				case modify:
					return doModify(data.req, callback);
				case indexingOneWithContent:
					return doIndexingOneWithContent(data.req, callback);
				case indexingMath:
					return doIndexingOneMath(data.req, callback);
			}
		} catch (e) {
			logger.log('error', 'indexing-one : ' + e.message);

			return doWork();
		}
	};

	return doWork();
};

/**
 * key의 개수에 상관없이 한꺼번에 처리
 * @param obj
 * @param alreadyCopied target db에 복사된 여부
 * @param done 콜백
 */
var doIndexingOne = function doIndexingOne(obj, alreadyCopied, done) {
	alreadyCopied = alreadyCopied || false;
	return mongodb.open('index', 'coredb').then(function (coredb) {

		return coredb.findOne({ _id: obj.name }, function (err, doc) {
			// core에서 해당 db의 내용 호출
			//2017.01.18 존재하지 않는 db 사용시 에러 처리
			if (err) {
				logger.log('error', "indexing one : fail\n" + err.message);
				return done(err);
			}

			if (doc == null) {
				logger.log('error', "indexing one : database is not exist, doc is null " + obj.name);
				return done();
			}

			doc.nowIndexingOne = true;

			coredb.save(doc, function (err) {
				if (err) {
					logger.log('error', "indexing one : fail\n" + err.message);
					return done(err);
				}

				obj = _.assign(obj, doc);
				obj.name = obj._id;

				if (alreadyCopied == true) {
					return indexer.indexingOne(obj, function (err) {
						// 복사된 내용 색인
						if (err) {
							logger.log('error', "indexing one : fail\n" + err.message);
							return done(err);
						}

						logger.log('info', 'indexing one : success ' + obj.name + '\n');

						return done();
					});
				} else {
					return dbcopy.add(obj, function (rslt) {
						// RDB에서 LDB로t 복사

						return indexer.indexingOne(obj, function (err) {
							// 복사된 내용 색인
							if (err) {
								logger.log('error', "indexing one : fail\n" + err);
								return done(err);
							}

							logger.log('info', 'indexing one : success ' + obj.name + '\n');
							return done();
						});
					});
				}
			});
		});
	});
};

/**
 * key 개수만큼 실행
 * @param obj
 * @param done
 */
var doRemove = function doRemove(obj, done) {
	//console.log('remove request ' , obj);
	return indexer.remove(obj, function () {
		logger.log('info', 'remove one : success\n');
		return done();
	});
};

/**
 * remove 후 insert 구조
 * @param obj
 * @param done
 */
var doModify = function doModify(obj, done) {
	//insert 및 remove는  key의 개수만큼 실행되어야 함 -> 중도 search 요청 때문 (2017.05.12)
	return indexer.remove(obj, function () {

		return doIndexingOne(obj, false, done);
	});
};

/**
 * 내용이 함께 요청되었을 때 동작하는 인터페이스
 * @param obj
 * @param done
 * @returns {*}
 */
var doIndexingOneWithContent = function doIndexingOneWithContent(obj, done) {
	indexer.remove(obj, function () {
		return mongodb.open('index', 'coredb').then(function (coredb) {

			return coredb.findOne({ _id: obj.name }, function (err, doc) {
				// core에서 해당 db의 내용 호출
				//2017.01.18 존재하지 않는 db 사용시 에러 처리
				if (err) {
					logger.log('error', "indexing one : fail\n" + err.message);
					return done();
				}

				if (doc == null) {
					logger.log('error', "indexing one : database is not exist, doc is null " + obj.name);
					return done();
				}

				obj = _.assign(obj, doc);
				obj.name = obj._id;
				return dbcopy.add(obj, function (rslt) {
					// RDB에서 LDB로 복사

					return indexer.indexingOneWithContent(obj, function (err) {
						// 복사된 내용 색인
						if (err) {
							logger.log('error', "indexing one : fail\n" + err);
							return done();
						}

						logger.log('info', 'indexing one : success ' + obj.name + '\n');
						return done();
					});
				});
			});
		});
	});
};

/**
 * 수식을 인덱싱하는 인터페이스
 * 수정 필요 (2017.12.13)
 * @param obj
 * @param done
 * @returns {*}
 */
var doIndexingOneMath = function doIndexingOneMath(obj, done) {
	return mongodb.open('index', 'coredb').then(function (coredb) {

		return coredb.findOne({ _id: obj.name }, function (err, doc) {
			// core에서 해당 db의 내용 호출
			//2017.01.18 존재하지 않는 db 사용시 에러 처리
			if (err) {
				return logger.log('error', "indexing one : fail\n" + err.message);
			}

			if (doc == null) return logger.log('error', "indexing one : database is not exist, doc is null " + obj.name);

			obj = _.assign(obj, doc);
			obj.name = obj._id;

			console.log((0, _stringify2.default)(obj));

			return indexer.indexingMath(obj, function (err) {
				// 복사된 내용 색인
				if (err) {
					logger.log('error', "indexing one : fail\n" + err);
				} else {
					logger.log('info', 'indexing one : success ' + obj.name + '\n');
				}
				return done();
			});
		});
	});
};
//# sourceMappingURL=indexingSeeker.js.map
