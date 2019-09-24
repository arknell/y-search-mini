/**
 * @author Saebyeok Lee
 * @since 0.1.1
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.one = one;
exports.withoutFileOne = withoutFileOne;
exports.doIndexing = doIndexing;
exports.getQuizDoc = getQuizDoc;
exports.readDataOne = readDataOne;
exports.stream = stream;
var mongodb = require('../commons/mongo'),
    util = require('../commons/utils'),
    ne = require('../commons/ne'),
    adder = require('./adder'),
    _ = require('lodash'),
    mp = require('../commons/MathParser');

var fs = require('fs');

var logger = require('../loggers/logger');

var separator = exports.separator = '-----------quizinfo-----------';
/**
 * 단위 색인, 증분 색인
 * @param opts  // core의 내용
 * @param cb    // callback
 */
function one(opts, cb) {
	var res = [];
	var parentKey = undefined;
	var done = _.after(1, function () {
		return adder(res, { name: opts.name, parentKey: parentKey }, function () {
			return cb(null);
		});
	});

	return _.forEach(opts.keys, function (keyOne, i) {

		return getQuizDoc(opts, keyOne, false, false, function (err, doc, body, docdb, paraParentKey, math) {
			if (err) {
				console.log('getQuizDoc - indexing one ', err);
				return cb(err);
			}

			parentKey = paraParentKey;
			return doIndexing(opts.apiurl, doc, body, docdb, res, math, done);
		});
	});
}

function withoutFileOne(opts, cb) {
	return _.forEach(opts.keys, function (keyOne, i) {
		return getQuizDoc(opts, keyOne, false, true, function (err, doc, body, docdb, parentkey) {
			//console.log(body);
			if (err) {
				console.log('getQuizDoc - indexing one ', err);
				return cb(err);
			}

			return cb(null, body);
		});
	});
}

function doIndexing(apiurl, doc, body, docdb, res, math, done) {
	var bodies = body.split(separator);
	var words = [];
	var tokenizeStr = "";
	//문항 메타 정보 (indexing text) -> 차후 업데이트 필요
	if (bodies.length > 0) {
		tokenizeStr += bodies[0];
	}

	//문항 분류 정보 (quiz info)
	if (bodies.length > 1) {

		var quizInfoList = bodies[1].split(/[\n.]/);

		//빈 칸일 경우를 제외하여 입력
		for (var i = 0; i < quizInfoList.length; i++) {
			if (quizInfoList[i] != '') words.push(quizInfoList[i]);
		}
	}

	// 문항 본문
	if (bodies.length >= 3) {
		tokenizeStr += ". " + bodies[2];
	}

	// 문항의 수식
	if (bodies.length >= 4) {
		var mathExpList = bodies[3].split(/[\n.]/);

		//빈 칸일 경우를 제외하여 입력
		for (var _i = 0; _i < mathExpList.length; _i++) {
			if (mathExpList[_i] != '') words.push("math:" + mathExpList[_i]);
		}
	}

	ne(apiurl, tokenizeStr).then(function (word) {
		words = words.concat(word);
		//console.log(tokenizeStr);
		//console.log(word);
		doc.tf = util.tf(words);
		//	console.log(doc.tf);

		if (math) {
			// 수식
			doc.math = math;
		}
		//console.log("doc", doc);
		res.push(doc);

		doc._isIndexed = true; // 색인 여부 추가
		//\media\teamsdata\Earlgae2014\01\92\019238\quizdata\2017\05\22\438399B26742499C9D4B60588A8E4E99\438399B26742499C9D4B60588A8E4E99_MATH.txt

		docdb.save(doc, function (err) {
			// 색인될 tf 값을 저장 --> 추후 색인 수정시 반영을 위함
			if (err) {
				return logger.log("error", err.message);
			}

			return done();
		});
	}).catch(function (err) {
		return logger.log("error", err.message);
	});
}

/**
 *
 * @param opts 문항 조건
 * @param keyOne 문항 key
 * @param onlyContent 본문만 가져올 것인지 여부
 * @param onlyMetaInfo 메타 정보만 가져올 것인지 여부
 * @param after
 * @returns {*}
 */
function getQuizDoc(opts, keyOne, onlyContent, onlyMetaInfo, after) {
	opts = opts || null;

	if (_.isNull(opts) || !_.isObject(opts)) {
		util.errorHandler('reader option is not defined', after);
		return;
	}
	//console.log(opts._id);
	return mongodb.open('index', opts._id, false).then(function (docdb) {
		return docdb.findOne({ _id: keyOne }, function (err, doc) {
			if (err) {
				logger.log("error", err.message);
				return after(err);
			}

			if (doc == null) {
				return after({ message: "code is not found : " + keyOne });
			}

			return readDataOne(opts.apiurl, doc, docdb, opts.index.columns, onlyContent, onlyMetaInfo, after);
		});
	}).catch(function (err) {});
}

function readDataOne(apiurl, doc, docdb, columns, onlyContent, onlyMetaInfo, cb) {

	//2017.01.23 open DB 수정 (없는 db일 경우 생성하지 않음)
	if (docdb == null) {
		console.log("wrong ldb");
		return cb({ message: 'wrong ldb' });
	}

	var isFile = false;
	var textKeys = _.map(_.filter(columns, function (o) {
		return o.type == "text" && o.name != 'quizbody' && o.name != 'QUIZBODY';
	}), 'name');
	//분류정보를 인덱싱 (2017.07.10)
	//text 또한 분류 정보로 인식, text의 경우 사용자 질의에서도 검색 가능, quizinfo는 오직 분류 검색에서만 가능 (2017.08.30)
	// quiz body is content => do not index for text data & text data with tag
	var quizInfoKey = _.map(_.filter(columns, function (o) {
		return (o.type == "info" || o.type == "text") && o.name != 'quizbody' && o.name != 'QUIZBODY';
	}), 'name');

	var parentKey = _.map(_.filter(columns, { type: 'parentkey' }), 'name')[0];

	var files = _.filter(columns, { type: 'filepath' });
	//var keyName = opts.core.index.pk;

	if (files.length > 0) {
		isFile = true;
		//files = files[0];
	}

	var body = '';
	var math = undefined;

	doc._key = doc._id;

	//문항 내용만 가져올 경우에는 메타정보, 문항 정보가 필요 없음
	if (onlyContent == false || onlyMetaInfo == true) {
		body = body + ' \n ' + getTextData(textKeys, doc);
		body = body + ' \n ' + getTextDataWithTag(quizInfoKey, doc);

		// -- 문항 메타정보만 가져올 경우에는 파일을 읽을 필요가 없음
		if (onlyMetaInfo == true) return cb(null, doc, body, docdb, parentKey, math);
	}

	var quizBody = doc["quizbody"] || doc["QUIZBODY"];

	if (quizBody) {
		body = body + ' \n ' + quizBody;
	}

	if (isFile) {
		(function () {
			var fileCnt = files.length;
			//console.log(fileCnt);
			var afterFile = _.after(fileCnt, function (body) {
				//return console.log(after);
				//console.log(body);
				return cb(null, doc, body, docdb, parentKey, math);
			});

			var _loop = function _loop(i) {
				var filepath = doc[files[i].name] + (files[i].postfix || '');
				doc['quizcode'] = doc['QUIZCODE'];
				// load and run script form db
				if (files[i].useScript) {
					var r = filepath;
					var item = files[i];

					eval(files[i].script);

					filepath = r;
				}

				util.getTextFromFile(apiurl, filepath, function (err, txt) {
					if (err) {
						return afterFile(body);
					}
					// -- 수식 인덱싱 기능 추가 필요 (2018.05.14)
					if (filepath.indexOf('_MATH') != -1) {

						mp.toAbstract(apiurl, txt.split('\n')).then(function (data) {
							body = body + ' \n ' + separator + data.join('\n');
							return afterFile(body);
						}).catch(function (err) {
							body = body + ' \n ' + txt;
							return afterFile(body);
						});
					} else {

						//console.log(txt);
						body = body + ' \n ' + txt;
						return afterFile(body);
					}
				});
			};

			for (var i = 0; i < fileCnt; i++) {
				_loop(i);
			}

			//console.log(filepath);
		})();
	} else {
		return cb(null, doc, body, docdb, parentKey, math);
	}
}

/**
 * doc에서 색인할 keys의 값을 추출
 * @param keys
 * @param doc
 * @returns {string}
 */
function getTextData(keys, doc) {
	var str = '';
	_.forEach(keys, function (n, i) {
		var value = doc[n] || doc[n.toUpperCase()];
		if (value) str = str + (doc[n] || doc[n.toUpperCase()]) + '  \n ';
	});

	return str;
}

/**
 * [key:value] 로 키워드 생성
 * @param keys
 * @param doc
 * @returns {string}
 */
function getTextDataWithTag(keys, doc) {
	var str = '';
	for (var index in keys) {
		var n = keys[index];
		var value = doc[n] || doc[n.toUpperCase()];
		if (!value) {
			//console.log(n);
			continue;
		}

		value = value.toString();
		if (value.replace(/\s+/g) == "") continue;

		str = str + n.toLowerCase() + ':' + value.replace(/\./ig, " ") + '\n';
	}

	return separator + str + separator;
}

/**
 * reader 전체 색인시 사용
 * @param {Object} opts
 * {
 *      count : number,         // 한번에 색인할 갯수
 *      start : string,         // 시작 key 값
 *      db : Object,            // ldb : target db (copied db)
 *      core : Object           // from coredb
 *  }
 * @param cb
 */
function stream(opts, cb) {
	opts = opts || null;

	if (_.isNull(opts) || !_.isObject(opts)) {
		util.errorHandler('reader option is not defined', cb);
		return;
	}

	if (!_.isObject(opts.db)) {
		// db is copied db
		util.errorHandler('reader option.db is not defined', cb);
		return;
	}

	if (!_.isObject(opts.core)) {
		util.errorHandler('reader option.core is not defined', cb);
		return;
	}

	if (!opts.count) {
		opts.count = 1000;
	}

	var parentKey = _.map(_.filter(opts.core.index.columns, { type: 'parentkey' }), 'name')[0]; // 상위 그룹이 있을 경우 ex) 시험지 및 문항

	var last = '0'; // 마지막 key 값
	var res = []; // 결과 배열
	var cnt = 0; // cnt
	var readCnt = 0; // ldb에서 가져온 cnt
	var ignoredCnt = 0; // 무시된 cnt

	console.log('option count - ', opts.count);

	// 콜백 (밑에 시작 부분에서 데이터 가져온 뒤에 실행 됨)
	var done = _.after(opts.count + 1, function () {
		console.timeEnd('readstream2');
		console.time('reverse index');

		// console.log(JSON.stringify(res[0].tf));
		// process.exit(1); // 강제 종료 (debug 용)
		// 색인 호출
		return adder(res, { name: opts.db.s.name, parentKey: parentKey }, function () {
			console.log('indexed ' + readCnt + ' docs, ignored ' + ignoredCnt + ' docs');

			console.timeEnd('reverse index');
			if (cnt < opts.count) {
				return cb(null, true, last, readCnt);
			} else {
				return cb(null, false, last, readCnt);
			}
		});
	});

	console.time('readstream1');

	// 시작
	opts.core.index.lastKey = opts.core.index.lastKey + "" || "0";
	opts.db.find({ _id: { $gt: opts.core.index.lastKey } }).sort({ _id: 1 }).limit(opts.count).toArray(function (err, result) {
		if (err) return util.errorHandler(' read stream err' + err.message, cb);

		var end = function end() {
			//end
			console.log('read steam end ' + last, readCnt);
			/*console.timeEnd('file');*/

			/*console.time('index');*/
			console.timeEnd('readstream1'); // 시간체크
			console.log(readCnt, opts.count);
			console.time('readstream2'); // 시간체크
			if (readCnt < opts.count) {
				for (var i = readCnt; i < opts.count; i++) {
					done();
				}
			}

			done(); // 색인 호출을 위한 콜백
		};

		readCnt = result.length;
		var index = 0;
		var getData = function getData() {
			var data = result[index++];
			if (!data) return end();

			if (data._id > last) last = data._id; // 마지막 키 대체

			return readDataOne(opts.core.apiurl, data, opts.db, opts.core.index.columns, false, false, function (err, doc, body, docdb, paraParentKey, math) {
				if (err && err.message == 'ignored') {
					ignoredCnt++;
				}

				parentKey = paraParentKey;
				return doIndexing(opts.core.apiurl, doc, body, docdb, res, math, function () {
					cnt++;
					done();
					return getData();
				});
			});
		};

		return getData();
	});
}
//# sourceMappingURL=reader.js.map
