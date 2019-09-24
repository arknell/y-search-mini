'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.isStop = exports.mongodb = undefined;

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

exports.indexingMath = indexingMath;
exports.indexingOne = indexingOne;
exports.remove = remove;
exports.indexingOneWithContent = indexingOneWithContent;
exports.run = run;
exports.stop = stop;
exports.removeAndUpdateRecovery = removeAndUpdateRecovery;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 메인 indexer : 색인 진입점
 * @author Saebyeok Lee
 * @type {any|*}
 * @since 0.1.1
 */
var _ = require('lodash');
var mongodb = exports.mongodb = require('../commons/mongo');
var util = require('../commons/utils'),
    reader = require('./reader');
var isStop = exports.isStop = true; // Stop 상태 여부
var logger = require('../loggers/logger');
var seeker = require('../seekers/indexingSeeker');
var adder = require('./adder');

/**
 * 수식 단일 색인
 * 수식은 추상화 트리 리스트로 색인됨
 * @param opts
 * @param cb
 * @returns {*}
 */
function indexingMath(opts, cb) {
	"use strict";

	if (!opts instanceof Object) {
		return util.errorHandler('indexer.js opts is not a Object.', cb);
	}

	if (typeof opts.name !== 'string') {
		return util.errorHandler('indexer.js opts.name is undefined.', cb);
	}

	var content = opts.content;
	opts.tf = {};
	var mathList = [];
	for (var index in content) {
		var math = content[index];

		mathList.push((0, _stringify2.default)(math));
	}
	// -- 추상 수식 리스트 확인
	console.log(mathList);

	// -- node 별 인덱싱
}

/**
 * 단일 색인
 * @param opts
 * @param cb
 * @returns {*}
 */
function indexingOne(opts, cb) {
	"use strict";

	if (!opts instanceof Object) {
		return util.errorHandler('indexer.js opts is not a Object.', cb);
	}

	if (typeof opts.name !== 'string') {
		return util.errorHandler('indexer.js opts.name is undefined.', cb);
	}

	return reader.one(opts, function (res) {
		return cb(res);
	});
}

/**
 * 색인 삭제
 * @param opts        // { name : 'DB명', keys: ['key1', 'key2'] }
 * @param callback    //    callback
 */
function remove(opts, callback) {
	"use strict";

	return mongodb.open('index', opts.name, false).then(function (collection) {
		var temp = {}; // tf Object

		//2017.01.23 open DB 수정 (없는 db일 경우 생성하지 않음)
		if (collection == null) {
			return console.log("wrong ldb");
		}

		console.log('remove command ', opts.keys);

		// 내부 콜백 함수
		var done = _.after(opts.length, function () {
			if ((0, _keys2.default)(temp).length == 0) return callback();

			return removeAndUpdate(opts.name, temp, opts.keys, function () {
				return callback(); // callback 호출
			});
		});

		return _.forEach(opts.keys, function (keyOne, i) {

			//key 삭제 코드 (2017.01.18 최종 수정)

			return collection.findOne({ _id: keyOne }, function (err, doc) {
				if (err) {
					throw err;
				}

				if (doc == null) {
					//2017.01.16 key 가 없다면 throw 가 아닌 continue 처리를 해야함, done 함수 실행을 위함, KCW
					console.log("Key is not found in database ", opts.name);

					return done();
				}

				//console.log("value" , doc);

				var K = _.size(doc.tf);
				for (var k = 0; k < K; k++) {
					// tf 값은 지우고, ndocs 값을 추가

					if (doc.tf[k]) {
						delete doc.tf[k].tf;
						doc.tf[k].ndocs = 1;
					}
				}
				//console.log('before tf ', doc.tf);
				temp = util.mergeSumObj(temp, doc.tf);
				//console.log('after tf ', temp);

				//2017.01.17 키 삭제
				return collection.deleteOne({ _id: keyOne }, function (err) {
					if (err) console.log(err);

					return done();
				});
			});
		});
	});
}

/**
 * 인덱싱할 컨텐츠를 함께 보내왔을 경우 처리
 * @param opts
 * @param cb
 * @returns {*}
 */
function indexingOneWithContent(opts, cb) {

	return reader.withoutFileOne(opts, function (err, body) {
		var quizKey = opts.keys[0];
		var quizContent = opts.content;

		var dbName = opts.name;
		return mongodb.open('index', dbName, false).then(function (collection) {
			body += quizContent;

			var res = [];

			var done = function done() {
				return adder(res, { name: dbName }, function () {
					return cb(null);
				});
			};

			return collection.findOne({ _id: quizKey }, function (err, doc) {
				if (err) return cb(err);

				if (doc == null) {
					console.log("why null", quizKey);
					console.log("why null", dbName);
				}
				doc._key = quizKey;
				//console.log(body);
				return reader.doIndexing(collection.apiurl, doc, body, collection, res, undefined, done);
			});
		}).catch(function (err) {
			console.log(err);
		});
	});
}

/**
 * 색인된 내용에서 해당 내용을 제거
 * @param name        // db 명 (table 명)
 * @param words            // 뺄 단어 Object {'word1', {freq : 1, ndocs : 1}, ... }
 * @param keys            // 문서 keys ['key1','key2', ... ]
 * @param callback
 */
function removeAndUpdate(name, words, keys, callback) {

	return mongodb.open('index', name + '_term', false).then(function (term) {
		if (term == null) {
			return console.log("wrong mongodb collection");
		}

		var bulkTerm = term.initializeUnorderedBulkOp();

		for (var key in words) {
			var val = words[key];

			//set value to minus
			for (var v in val) {
				val[v] = -val[v];
			}

			bulkTerm.find({ _id: key }).update({ $inc: val });
		}

		return bulkTerm.execute();
	}).then(function () {
		return mongodb.open('index', name + '_posting', false);
	}).then(function (posting) {
		if (posting == null) {
			return console.log("wrong mongodb collection");
		}

		var size = _.size(words) * 2;

		if (size < 1) {
			console.log('removeAndUpdate - words.size() is 0');
			return callback();
		}

		var bulk = posting.initializeUnorderedBulkOp();

		var quiz = {};
		for (var index in keys) {
			var val = keys[index];
			quiz[val] = "";
		}

		for (var key in words) {
			bulk.find({ _id: key }).update({ $unset: quiz });
		}

		return bulk.execute();
	}).then(function () {
		return callback();
	}).catch(function (err) {
		return console.log(err);
	});
}

/**
 * 웹서비스에서 호출하는 색인 함수
 * 1. 기본 파라메터 셋팅
 * 2. core 정보를 가져와서 색인을 하는 재귀 함수(async)를 호출
 * @param {Object} opts
 * {
 *     repeat : Boolean, //option - default false
 *     name : string,
 *     count : number, //option - default 10000
 *     unit : number,  //option - default 100
 * }
 * @param cb
 */
function run(opts, cb) {
	// opts { name : '', event : Object() }
	"use strict";

	if (!opts instanceof Object) {
		return util.errorHandler('indexer.js opts is not a Object.', cb);
	}

	if (typeof opts.name !== 'string') {
		return util.errorHandler('indexer.js opts.name is undefined.', cb);
	}

	opts.repeat = opts.repeat || false; // opts { name : 'quizdoc', event : Object(), repeat : false, unit : 500 }
	opts.unit = opts.unit || 500;

	return mongodb.open('core', 'coredb').then(function (coredb) {
		return mongodb.open('batch', opts.name, false) // 색인을 위해 복사된 db
		.then(function (docdb) {

			//2017.01.23 open DB 수정 (없는 db일 경우 생성하지 않음)
			if (docdb == null) {
				return logger.log('error', "[error] can't indexing! wrong ldb " + opts.name);
			}

			exports.isStop = isStop = false;
			return coredb.findOne({ _id: opts.name }, function (err, doc) {
				// core db에서 정보 가져옴
				//expect(err).to.be.a('null');
				if (err) throw err;

				var done = function done(err) {
					// 색인이 끝났을 경우
					if (err) return logger.log(logger.debugLevel, err);

					// 색인 상태를 false로 변경 후 db에 업데이트
					doc.isIndexing = false;
					exports.isStop = isStop = true;
					return coredb.save(doc, function (err) {
						if (err) throw err;

						console.log('finished indexing ' + opts.name);
						return cb();
					});
					//console.log('done');
				};

				// DB에 색인 상태로 변경
				doc.isIndexing = true;
				coredb.save(doc, function (err) {
					if (err) throw err;
				});
				// 색인 카운트

				opts.count = doc.index.total;
				doc.index.doneCnt = doc.index.doneCnt || 0;
				// 비동기 색인 호출
				if (opts.isEach == true) {
					//console.log(doc);
					console.log('index each is gone');
					return cb();
				} else {
					console.log('do index all');
					return async(doc.index.doneCnt, opts.count, coredb, opts.unit, docdb, doc, opts.event, done);
				}
			});
		}).catch(function (err) {
			return util.errorHandler(err.message, cb);
		});
	}).catch(function (err) {
		return util.errorHandler(err.message, cb);
	});
}

/**
 * db를 열어서 key의 내용을 doc(value)으로 업데이트
 * @param db
 * @param key
 * @param doc
 * @param cb
 */
function save(db, key, doc, cb) {
	"use strict";

	return db.save(doc, function (err) {
		if (err) {
			return cb(err);
		}

		return cb(null);
	});
}

/**
 * 비동기 색인 함수
 * @param i         // 시작 index
 * @param total     // 전체 index
 * @param coredb    // core ldb
 * @param unit      // 한번에 색인할 갯수 (현재 함수에서 처리할 갯수)
 * @param docdb     // 복사된 ldb
 * @param doc       // core 내용
 * @param event     // 웹페이지 호출 용 socket (색인 결과를 중간 중간 리턴)
 * @param cb        // 콜백 함수
 */
function async(i, total, coredb, unit, docdb, doc, event, cb) {
	"use strict";

	console.log("total :" + total + ", i " + i, isStop);
	if (i >= total || isStop === true) {
		// 현재 i가 total 값 보다 클 경우 색인 완료
		console.log("total2 :" + total + ", i " + i, isStop);

		return coredb.save(doc, function (err) {

			return cb();
		});
	}

	return read(coredb, unit, docdb, doc) // read 함수 호출
	.then(function (core) {
		// 성공일 경우
		console.log('read');
		return async(i + unit, total, coredb, unit, docdb, doc, event, cb); // i값을 증가하서 재귀 호출
	}).catch(function (err) {
		return cb(err);
	}); // 실패일 경우
}

function stop() {
	"use strict";

	exports.isStop = isStop = true;
}

/**
 * Reader를 호출하여 DB에서 색인할 갯수 만큼의 복사된 문서(record)를 불러옴
 * @param coredb        // core ldb
 * @param unit          // 읽을 갯수
 * @param docdb         // 문서가 복사된 ldb
 * @param core          // core Object
 * @returns {Promise}   // callback 대신 사용
 */
function read(coredb, unit, docdb, core) {
	"use strict";

	return new _promise2.default(function (resolve, reject) {
		// reader.js 함수의 stream 부분 호출

		return reader.stream({ // reader.js 함수의 stream 부분 호출
			count: unit,
			db: docdb,
			core: core,
			start: core.index.lastKey
		}, function (err, done, last, cnt) {
			if (err) throw err;

			core.index.doneCnt = (core.index.doneCnt || 0) + cnt;
			core.index.lastKey = last;
			/*
    Indexed number of documents : 0
    Last Indexed Key: 0
    */
			console.log('lastKey ' + last);

			return save(coredb, core.name, core, function (err) {
				if (err) return reject(err);else return resolve(core);
				//cb(null);
			});
		});
	});
}

/**
 * 색인된 내용에서 해당 내용을 제거
 * @param name        // db 명 (table 명)
 * @param words            // 뺄 단어 Object {'word1', {freq : 1, ndocs : 1}, ... }
 * @param keys            // 문서 keys ['key1','key2', ... ]
 * @param callback
 */
function removeAndUpdateRecovery(name, words, keys, callback) {
	if ((0, _keys2.default)(words).length == 0) {
		return deleteKeyFromDB(name, keys, callback);
	}

	return deleteTerm(name, words, function (err) {
		console.log('delete term complete');
		if (err) {
			console.log(err);
			return deleteKeyFromDB(name, keys, callback);
		}

		return deletePosting(name, words, keys, function (err) {
			if (err) {
				console.log(err);
			}
			console.log('delete posting complete');
			return deleteKeyFromDB(name, keys, callback);
		});
	});
}

function deleteTerm(name, words, callback) {
	return mongodb.open('index', name + '_term', false).then(function (term) {
		if (term == null) {
			return console.log("wrong mongodb collection");
		}

		var i = 0;
		var executeDelete = function executeDelete() {
			var key = (0, _keys2.default)(words)[i++];
			if (!key) {
				return callback();
			}

			var val = words[key];

			//set value to minus
			for (var v in val) {
				val[v] = -val[v];
			}

			return term.update({ _id: key }, { $inc: val }, function (err) {
				if (err) console.log(err);
				return executeDelete();
			});
		};

		return executeDelete();
	});
}

function deletePosting(name, words, keys, callback) {
	return mongodb.open('index', name + '_posting', false).then(function (posting) {
		if (posting == null) {
			console.log("wrong mongodb collection");
			return callback();
		}

		var quiz = {};
		for (var index in keys) {
			var val = keys[index];
			quiz[val] = "";
		}

		var i = 0;
		var executeDelete = function executeDelete() {
			var key = (0, _keys2.default)(words)[i++];
			if (!key) return callback();

			return posting.update({ _id: key }, { $unset: quiz }, function (err) {
				if (err) console.log(err);
				return executeDelete();
			});
		};

		return executeDelete();
	});
}

function deleteKeyFromDB(name, keys, callback) {
	mongodb.open('index', name, false).then(function (collection) {
		var removeQuery = [];
		for (var i = 0; i < keys.length; i++) {
			removeQuery.push({ _id: keys[i] });
		}

		return collection.remove({ $or: removeQuery }, function () {
			return callback();
		});
	}).catch(function (err) {
		return callback(err);
	});
}
//# sourceMappingURL=indexer.js.map
