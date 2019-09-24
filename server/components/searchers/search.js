/**
 * 검색 본체
 * TF-IDF 참조 : https://ko.wikipedia.org/wiki/TF-IDF
 * 벡터공간모델 참조 : https://ko.wikipedia.org/wiki/%EB%B2%A1%ED%84%B0_%EA%B3%B5%EA%B0%84_%EB%AA%A8%EB%8D%B8
 * @author Saebyeok Lee, Chanwoo Kwon
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

exports.search = search;
exports.saveSearchWord = saveSearchWord;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _ = require('lodash');
var ne = require('../commons/ne'),
    util = require('../commons/utils'),
    mongodb = require('../commons/mongo'),
    env = require('../../config/environment'),
    reader = require('../indexers/reader'),
    synonyms = require('../synonyms/synonym');
var request = require('request');

var SimilarityChecker = require('../similarity/SimilarityChecker'); // 코사인 유사도 계산 라이브러리
var similarityChecker = new SimilarityChecker();

/**
 * main 검색 호출
 * @param opts
 *   - q : 질의 Text
 - name : 색인 DB 명
 - start : 페이징 시작 index (0, 1, 2, 3 ...)
 - limit : 페이징 갯수
 - isCode : 퀴즈 코드 여부 (default : ```false```)
 - quizInfo : 문항 필터링 정보 (default : ```null```, {"class0" : "A7", "class1" : "92", "hard2": "12", "cmsid" : "1" ...})
 - origin : 원본 데이터 (default : ```false```)
 - full : 검색어 전체 일치 여부 (default : ```false```, ```true```설정시 AND 검색, ```false```일 경우 약 70% 일치해야 가져옴)
 - isTest : 시험지 여부 (시험지에 포함된 문항 키워드 검색 -> 시험지와 시험지에 포함된 모든 문항을 리턴)
 - preset : 검색할 문항 (건너온 문항 코드에서만 단어 검색)
 - where : 조건문 (and, or 연산)
 - groupby : 그룹핑할 컬럼
 - group : pcode로 ordering 여부
 - getAll : 키워드가 없을 경우 조건에 부합하는 모든 문항을 가져올지에 관한 여부
 - isEarlgae : 얼개문항 여부 (default : false) (2019.02.11)
 - match : 일치하는 단어 가져오기 여부 (default : false) (2019.04.23)
 - realSim : 실제 검색어가 아닌 문항의 벡터 유사도를 비교하는 지 여부 (2019.04.26)
 * @param callback
 */
function search(opts, callback) {
	if (!_.isObject(opts)) {
		util.errorHandler('option is not a Object', callback);
		return;
	}

	if (opts.name === undefined) {
		util.errorHandler('option.name is undefined', callback);
		return;
	}

	if (!opts.start) {
		opts.start = 0;
	} else if (!_.isNumber(opts.start)) {
		opts.start = _.parseInt(opts.start);
	}

	if (!opts.limit) {
		opts.limit = 0;
	} else if (!_.isNumber(opts.limit)) {
		opts.limit = _.parseInt(opts.limit);
	}

	if (!opts.isTest) {
		opts.isTest = false;
	}

	if (opts.quizInfo) {
		console.log("quizInfo", opts.quizInfo);
	}

	//calculate start
	opts.start = opts.start * opts.limit;

	var quizInfo = getQuizInfoKeyword(opts.quizInfo);

	// -- 필터링에 필요한 프리셋 문항 (정해질 경우 프리셋 문항 내에서만 키워드 검색)
	var preset = void 0;
	if (opts.preset) preset = opts.preset.split(/\s*,\s*/i);else preset = undefined;

	opts.full = opts.full || false;
	var empty = { count: 0, page: 0, limit: opts.limit, start: opts.start, list: [] };
	//console.log('opts.full', opts.full);

	// -- 키워드 검색을 실행
	var executeSearch = function executeSearch(err, opts) {
		if (err) return callback(err);
		//console.log(preset);
		return getDocList(opts, opts.q + "", quizInfo, preset, function (list, keywords) {

			console.log("db : " + opts.name);
			console.log("text : " + opts.q);
			//console.log("res : ", list);

			if (_.isEmpty(list)) {
				return callback(null, empty);
			}

			if (opts.isCode && (opts.isCode == true || opts.isCode == 'true')) {
				var code = opts.code;
				console.log("code ", code);
				var index = list.findIndex(function (o) {
					return o["key"] == code;
				});

				list.splice(index, 1);
			}

			if (opts.isTest == true) {
				// -- 시험지 검색 여부
				return makeTest(opts, list, function (err, list) {
					if (err) return console.log(err);

					return callback(null, list);
				});
			} else if (opts.groupby) {
				// -- 그룹핑 여부
				if (list.length > 2000) {
					// -- 시간이 오래걸리기 때문에 2000개 이상의 결과가 나올 경우 사용자에게 에러 메시지를 발송한다.
					return callback({ message: "NEED_MORE_CLASSIFICATION" });
				}

				return getOrigin(opts.name, list, function (err, result) {
					if (err) return callback(err);

					var groupBy = function groupBy(xs, key) {
						return xs.reduce(function (rv, x) {
							(rv[x[key]] = rv[x[key]] || []).push(x);
							return rv;
						}, {});
					};

					var groupingList = groupBy(result, opts.groupby);
					var combineList = [];
					for (var key in groupingList) {
						combineList = combineList.concat(groupingList[key].sort(function (o1, o2) {
							var sim1 = parseFloat(o1.sim);
							var sim2 = parseFloat(o2.sim);
							if (sim1 < sim2) return 1;else if (sim1 > sim2) return -1;else return 0;
						}));
					}

					var res = {
						count: combineList.length,
						list: _.slice(combineList, opts.start, opts.start + opts.limit),
						page: Math.floor(opts.start / opts.limit) + 1,
						limit: opts.limit,
						start: opts.start
					};

					if (!opts.origin || opts.origin == false || opts.origin === "false") {
						res = setSimple(res);
					}

					return callback(null, res);
				});
			} else if (!opts.group || opts.group == false || opts.group === "false") {
				// -- 일반 검색
				if (opts.realSim && (opts.realSim == true || opts.realSim === "true")) {
					list = list.filter(function (o) {
						return o.match.length > keywords.length / 2;
					});

					return getOrigin(opts.name, list, function (err, result) {
						result = calRealSim(keywords, result);
						result = result.map(function (o) {
							var newO = {
								key: o.key,
								sim: o.sim,
								realSim: o.realSim,
								match: o.match
							};

							return newO;
						});

						result.sort(function (o1, o2) {
							return o2.realSim - o2.realSim;
						});

						var res = {
							count: list.length,
							list: result,
							page: Math.floor(opts.start / opts.limit) + 1,
							limit: opts.limit,
							start: opts.start
						};
					});
				} else {
					console.log("total normal : " + list.length);
					if (opts.origin === 'true' || opts.origin == true) {

						var sliced = _.slice(list, opts.start, opts.start + opts.limit);
						return getOrigin(opts.name, sliced, function (err, result) {

							result = calRealSim(keywords, result);
							var res = {
								count: list.length,
								list: result,
								page: Math.floor(opts.start / opts.limit) + 1,
								limit: opts.limit,
								start: opts.start
							};

							return callback(null, res);
						});
					} else {
						var res = {
							count: list.length,
							list: _.slice(list, opts.start, opts.start + opts.limit),
							page: Math.floor(opts.start / opts.limit) + 1,
							limit: opts.limit,
							start: opts.start
						};

						return callback(null, res);
					}
				}
			} else {
				// -- 그룹화 (pcode로 ordering)
				// -- 바뀌는 내용은 이정철 책임과 상의해야함
				if (list.length > 2000) {
					return callback({ message: "NEED_MORE_CLASSIFICATION" });
				}

				return getOrigin(opts.name, list, function (err, result) {
					if (err) return callback(err);

					return sorting(result, function (sortedList) {
						var res = {
							count: sortedList.length,
							data: _.slice(sortedList, opts.start, opts.start + opts.limit),
							result: "success",
							message: ""
						};

						if (!opts.origin || opts.origin == false || opts.origin === "false") {
							res = setSimple(res);
						}

						return callback(null, res);
					});
				});
			}
		});
	};

	// -- 코드 검색, 키워드 검색 여부 확인 후 실행
	var search = function search() {
		if (opts.isCode && (opts.isCode == true || opts.isCode == 'true')) {
			//read quiz contents
			// -- 코드 검색일 경우 코드에 해당하는 문항의 내용을 가져온다.
			return getQuizContents(opts, executeSearch);
		} else {
			// -- 키워드 검색일 경우 키워드 검색 실행
			return executeSearch(null, opts);
		}
	};

	// -- 키워드를 포함하지 않고 모든 문항을 가져오는 경우
	if ((opts.getAll == 'true' || opts.getAll == true) && opts.q.length == 0) {
		// -- 모든 알고리즘을 다시 정리
		return getAll(opts, quizInfo, function (list, count, alreadySliced) {
			// -- 일반 검색
			console.log("total normal : " + list.length);
			var sliced = _.slice(list, opts.start, opts.start + opts.limit);
			if (opts.origin === 'true' || opts.origin == true) {
				return getOrigin(opts.name, alreadySliced ? list : sliced, function (err, result) {
					var res = {
						count: count || list.length,
						list: result,
						page: Math.floor(opts.start / opts.limit) + 1,
						limit: opts.limit,
						start: opts.start
					};

					return callback(null, res);
				});
			} else {
				var res = {
					count: count || list.length,
					list: alreadySliced ? list : sliced,
					page: Math.floor(opts.start / opts.limit) + 1,
					limit: opts.limit,
					start: opts.start
				};

				return callback(null, res);
			}
		});
	}

	// -- 조건문 여부 확인
	if (opts.where) {
		// -- 조건문이 있을 경우 조건에 해당하는 문항 리스트를 확보
		return where(opts.where, function (err, res) {
			// -- 기존 프리셋 문항 리스트와 and 연산
			if (err) {
				console.log(err);
				return search();
			}

			// -- 문항 코드 정보만 가지고 있음.
			var arrayRes = (0, _keys2.default)(res);

			// -- 프리셋 문항으로 세팅
			if (preset == undefined) {
				preset = arrayRes;
			} else {
				// -- 기존프리셋이 있을 경우 and 연산
				preset = _.union(preset, arrayRes);
			}

			if (preset.length == 0) {
				// -- 프리셋이 0일 경우 검색을 진행할 필요가 없음
				return callback(null, empty);
			}

			// -- 검색 실행
			return search();
		});
	} else {
		// -- 조건문이 없을 경우 검색 실행
		return search();
	}
}

function getAll(opts, quizInfo, cb) {
	if (quizInfo.length == 0) {
		return mongodb.open('search', opts.name, false).then(function (collection) {
			collection.count(function (err, count) {
				return collection.find({}, { _id: 1 }).skip(opts.start).limit(opts.limit).toArray(function (err, res) {
					if (err || res == null) {
						return cb([]);
					}

					res.map(function (e, i) {
						e.key = e._id;
						e.sim = 1;
					});

					return cb(res, count, true);
				});
			});
		});
	} else {
		return mongodb.open('search', opts.name + "_posting", false).then(function (collection) {
			return getQuizInfoContent(opts, collection, quizInfo, undefined, function (filterKey) {
				// object preset to array
				var keys = [];
				filterKey.map(function (e, i) {
					keys.push({
						key: e,
						sim: 1
					});
				});

				return cb(keys);
			});
		});
	}
}

/**
 * 문항 검색 결과를 시험지 처럼 만듬
 */
function makeTest(opts, list, callback) {
	if (list.length == 0) return callback(undefined, list);

	mongodb.open('search', 'coredb', false).then(function (coredb) {
		return coredb.findOne({ "_id": opts.name }, function (err, doc) {
			if (err || doc == null || doc.index.parentkey == undefined || doc.index.parentkey == '') {
				//console.log(doc);
				return callback(undefined, list);
			}

			var orOperation = [];
			for (var index in list) {
				var value = list[index];
				orOperation.push({
					child: {
						$elemMatch: {
							$eq: value.key
						}
					}
				});
			}

			mongodb.open('search', opts.name + "_group", false).then(function (groupCollection) {
				groupCollection.find({
					$or: orOperation
				}).toArray(function (err, res) {
					if (err) return callback(err);

					if (res == null) {
						return callback(undefined, list);
					}

					var origin = [];

					var done = function done() {
						var testList = [];

						var _loop = function _loop(_index) {
							var value = res[_index];
							var replaceChild = [];

							var match = list.filter(function (o1) {
								return value.child.find(function (o2) {
									return o1.key == o2;
								}) != undefined;
							});

							for (var i in match) {
								match[i].key = match[i].key.replace(value._id, '');
							}

							var _loop2 = function _loop2(_i) {
								var matchOne = match.find(function (o) {
									return o.key == value.child[_i].replace(value._id, '');
								});

								replaceChild.push({
									key: value.child[_i].replace(value._id, ''),
									isMatch: matchOne != undefined,
									sim: matchOne != undefined ? matchOne.sim : 0
								});
							};

							for (var _i in value.child) {
								_loop2(_i);
							}

							//console.log(match);
							var testOne = {
								key: value._id,
								child: replaceChild
							};

							testList.push(testOne);
						};

						for (var _index in res) {
							_loop(_index);
						}

						return callback(undefined, testList);
					};

					if (opts.origin) {
						// -- 모든 문항의 상세 정보를 가져옴
						mongodb.open('search', opts.name, false).then(function (collection) {
							var orOperation = [];
							for (var i in res) {
								var _value = res[i];
								for (var j in _value.child) {
									var item = _value.child[j];
									orOperation.push({ _id: item.key });
								}
							}

							collection.find({ $or: orOperation }).toArray(function (err, docs) {
								if (err) return callback(err);
								if (docs == null || docs.length == 0) return callback(undefined, list);

								origin = docs;
								return done();
							});
						}).catch(function (err) {
							return callback(err);
						});
					} else {
						return done();
					}
				});
			}).catch(function (err) {
				return callback(err);
			});
		});
	}).catch(function (err) {
		return callback(err);
	});
}

/**
 * 결과의 simple 버전
 * isGroup 일 때만 사용
 * @param res 결과
 * @returns {*}
 */
function setSimple(res) {
	console.log('simple');
	var list = void 0;
	if (res.list) {
		list = res.list;
	} else {
		list = res.data;
	}

	for (var i = 0; i < list.length; i++) {
		list[i] = { key: list[i].key, sim: list[i].sim, pcode: list[i].pcode };
	}

	//console.log(res);
	return res;
}

/**
 * 문항 코드를 이용한 검색 시 해당 코드의 문항 본문을 가져옴
 * @param opts 검색 조건, quizcode 등
 * @param callback 콜백
 */
function getQuizContents(opts, callback) {
	// 다중 코드 검색 -> 현재 미구현 (2018.01.15)
	// 코드는 ',' 로 구분하여 전송
	// 결과는 전체 리스트로 반환? -> 미정

	return mongodb.open('search', 'coredb').then(function (core) {
		return core.findOne({ _id: opts.name }, function (err, obj) {
			return reader.getQuizDoc(obj, opts.q, true, false, function (err, doc, words) {
				console.log("word", words);
				if (err) return callback(err);

				// -- 질의어를 문항 코드에서 문항을 구성하는 단어로 교체
				opts.code = opts.q;
				opts.q = words;
				callback(null, opts);
			});
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

/**
 * 질의어가 포함된 문항들을 가져와서 문서벡터(TF-IDF) 형태로 만들어 줌
 * @param opts          // 메인 함수의 opts 그대로 넘김
 * @param words         // 추출된 단어 배열
 * @param idf           // 각 단어 배열에 매칭되는 idf 값
 * @param quizInfoKeywords // 분류 정보
 * @param mustpreset    // 검색할 문항 (없을 경우 undefined)
 * @param callback      // 콜백
 */
function getDocVector(opts, words, idf, quizInfoKeywords, mustpreset, callback) {

	var dbname = opts.name;

	var res = {};
	var size = _.size(words);

	return mongodb.open('search', dbname + '_posting', true).then(function (db) {
		//console.log(_.size(wordObj));
		var promise = function promise() {
			if (size > 1 && !opts.full) {
				//_(res).forEach(function (val, key) {          //   { d1: [1.0, 0.7, ... ], d2 : []}
				//	//console.log(val);
				//	if (_.compact(val).length < Math.ceil(size / 1.5)) {
				//		delete res[key];
				//	}
				//});
			} else {
				_(res).forEach(function (val, key) {
					if (_.compact(val).length < size) {
						delete res[key];
					}
				});
			}

			//console.log(res);
			return callback(res);
		};

		var searchWord = []; //검색 단어 셋

		for (var key in words) {
			var val = words[key];
			searchWord.push(key);

			for (var i = 0; i < val.synonyms.length; i++) {
				searchWord.push(val.synonyms[i]);
			}
		}

		var afterPreset = function afterPreset(filterKeys) {
			if (filterKeys.length == 0) {
				if (quizInfoKeywords.length != 0) {
					//quizInfoKeywords 가 있는 상태에서 filterKeys 가 0일 경우 -> 분류 검색 후 결과 없음
					return promise();
				} else if (mustpreset != undefined) {
					filterKeys = mustpreset;
				}
			}

			var orOperation = [];

			for (var _i2 = 0; _i2 < searchWord.length; _i2++) {
				orOperation.push({ _id: searchWord[_i2] });
			}

			return db.find({ $or: orOperation }).toArray(function (err, result) {
				// 분수 : { quiz1 : {tf : 0.7, freq : 2}, quiz2 : {...} }
				if (err) {
					return console.log('Ooops!', err);
				}

				var _loop3 = function _loop3(_i3) {
					var obj = result[_i3] || {};

					if ((0, _keys2.default)(filterKeys).length != 0) {
						// -- filterKeys가 0일 경우 -> 전체 검색
						obj = _.pick(obj, filterKeys);
					}

					var word = obj._id;
					for (var doc in obj) {
						if (doc == '_id') continue;
						// calculate tf-idf
						// doc is quiz code or _id
						var idfOne = idf.find(function (o) {
							return o.key == word;
						});
						if (idfOne != undefined) {
							obj[doc] = obj[doc] * idfOne.idf;

							if (res[doc] == undefined) {
								res[doc] = new Array(idf.length).fill(0);
							}

							var index = idf.findIndex(function (o) {
								return o.key == word;
							});

							res[doc][index] = obj[doc];
						}
					}
				};

				for (var _i3 = 0; _i3 < result.length; _i3++) {
					_loop3(_i3);
				}

				return promise();
			});
		};

		if (quizInfoKeywords.length == 0) {
			return afterPreset({});
		} else {
			return getQuizInfoContent(opts, db, quizInfoKeywords, mustpreset, afterPreset);
		}
	}).catch(function (err) {
		return console.log(err);
	});
}

function getQuizInfoContent(opts, db, quizInfoKeywords, mustpreset, callback) {
	var presetOrOperation = [];
	var preset = {};
	for (var key in quizInfoKeywords) {
		var val = quizInfoKeywords[key];
		var item = void 0;
		var searchWord = void 0;
		if (val.isClass) {
			var splitClass = val.value.split('-');
			var index = splitClass.findIndex(function (o) {
				return o == "0";
			});

			searchWord = new RegExp(val.className + ":" + splitClass.slice(0, index).join('-') + ".*");
		} else {
			searchWord = new RegExp(val.className + ":.*" + val.value + ".*");
		}

		item = { _id: { $regex: searchWord } };
		presetOrOperation.push(item);
	}

	// 얼개 문항 검색
	var andOp = [];
	if (opts.isEarlgae) {
		andOp.push({ _id: 'iossection:EG' });
	} else {
		andOp.push({ _id: { $not: { $eq: 'iossection:EG' } } });
	}

	//quiz info (and 및 or 구분)를 키워드화하여 무조건 해당 키워드를 포함하는 quiz를 가져와야함 (2017.07.11)
	return db.find({ $or: presetOrOperation, $and: andOp }).toArray(function (err, result) {
		if (err) {
			preset = {};
			console.log(err);
			return callback(preset);
		}
		//console.log(presetOrOperation, result);
		for (var i = 0; i < result.length; i++) {
			var _key = result[i]._id.split(':');

			var _obj = result[i] || {};
			var value = preset[_key[0]];
			if (value == undefined) {
				preset[_key[0]] = _obj;
			} else {
				// 'or' operation, filter by key:value pair, classlname:복소수, class4:03, class4:04, etc
				(0, _assign2.default)(preset[_key[0]], _obj);
			}
		}

		var filter = {};
		var first = true;
		// and operation
		// filter by key name, classname, class3, etc
		// 필터 키가 없는 경우 문항코드 제거
		for (var _key2 in preset) {
			var _value2 = preset[_key2];

			if (first) {
				filter = preset[_key2];
				first = false;
			} else {
				filter = _.pick(filter, _.keys(_value2));
			}

			if (mustpreset != undefined) filter = _.pick(filter, mustpreset);
		}

		var filterKeys = _.keys(filter);
		return callback(filterKeys);
	});
}

/**
 * mongodb collection [dbname]_term에서 질의어 들에 대한 IDF 값을 계산
 * @param dbname    // 색인 명
 * @param tfs       // tf 계산한 값 {w1 : {freq : 1, tf: 0.72}, w2 : {freq : 1, tf: 0.72}}
 * @param callback  // 콜백
 */
function getIdf(dbname, tfs, callback) {
	var res = [];
	var res2 = [];

	return mongodb.open('search', dbname + '_term').then(function (db) {
		// 콜백  (나중에 실행됨)
		var promise = function promise() {
			// tfs.length
			var maxobj = _.maxBy(res, 'ndocs');
			var largeN;
			if (_.isObject(maxobj) && !_.isEmpty(maxobj)) {
				largeN = (maxobj.ndocs || 1) * 2; // idf의 분자 값
			} else {
				largeN = 1;
			}
			//console.log('large N '+ largeN);
			_.forEach(res, function (n, i) {
				if (_.isUndefined(n.ndocs)) {
					n.ndocs = 0;
				}

				res2[i] = { key: n.key, idf: _.isNaN(Math.log(largeN / n.ndocs)) ? 1 : Math.log(largeN / n.ndocs) + 1 }; // idf
			});
			return callback(res2); // res2 = [1.0, 0.7, ... ]
		};

		var orOperation = [];

		for (var key in tfs) {
			orOperation.push({ _id: key });
		}

		return db.find({ $or: orOperation }).toArray(function (err, result) {
			//db            ex) key = '최빈값'
			if (err) {
				return console.log('Ooops!', err);
			}

			var _loop4 = function _loop4(_key3) {
				var obj = result.find(function (o) {
					return o._id == _key3;
				});

				if (obj) {
					res.push({ key: obj._id, ndocs: obj.ndocs, freq: obj.freq });
				} else {
					res.push({ key: _key3, ndocs: 1, freq: 1 });
				}
			};

			for (var _key3 in tfs) {
				_loop4(_key3);
			}

			return promise();
		});
	}).catch(function (err) {
		console.log(err);
	});
}

/**
 * TF-IDF 값으로 질의와 각 문서간의 cosine 유사도를 계산
 *
 * TF-IDF 참조 : https://ko.wikipedia.org/wiki/TF-IDF
 * @param opts
 * @param query
 * @param quizInfoKeywords
 * @param preset
 * @param callback
 */
function getDocList(opts, query, quizInfoKeywords, preset, callback) {

	var dbname = opts.name;

	console.time('ne');
	// 색인어 추출기 ex) 분수를 사용한 최빈값 구하기 --> 분수, 사용, 최빈값 , ...
	mongodb.open('search', 'coredb', false).then(function (collection) {
		collection.findOne({ _id: dbname }, function (err, core) {
			if (err) {
				console.log(err);
				return callback([]);
			}

			return ne(core.apiurl, query).then(function (keywords) {
				if (keywords.length == 0) keywords.push(query);

				console.log(query);
				console.log(keywords);
				console.timeEnd('ne');

				if (keywords.length == 0) {
					callback([]);
				} else {
					var tf;

					(function () {
						console.time('freq');
						tf = util.tf(keywords, 'freq');


						var tfLength = (0, _keys2.default)(tf).length;
						console.timeEnd('freq');

						var done = _.after(tfLength, function () {

							return getIdf(dbname, tf, function (idf) {
								// idf = [1.02, 0.67, ...  ]

								var q = util.queryToVector(tf, idf); // tf*idf [1.32, 0.73, 9.33, ... ]
								console.time('search');
								return getDocVector(opts, tf, idf, quizInfoKeywords, preset, function (docVectors) {
									console.timeEnd('search');
									var rank = util.ranking(q, docVectors);
									if (opts.match) {
										for (var i = 0; i < rank.length; i++) {
											var key = rank[i].key;
											var idfOne = docVectors[key];
											var occurredWord = [];
											for (var j = 0; j < idfOne.length; j++) {
												var _word = idf[j].key;
												if (idfOne[j] != 0) {
													occurredWord.push(_word);
												}
											}

											rank[i].match = occurredWord;
										}
									}

									//	console.log(rank);

									return callback(rank, keywords);
								});
							});
						});

						//검색에 유사어 추가 (2017.06.07)

						var _loop5 = function _loop5(key) {
							synonyms.getWord(key, function (result) {
								var spliter = result.split(';');
								var synonymsList = [];
								for (var j = 0; j < spliter.length; j++) {
									if (spliter[j] !== '') synonymsList.push(spliter[j]);
								}

								tf[key] = { 'count': tf[key], 'synonyms': synonymsList };
								return done();
							});
						};

						for (var key in tf) {
							_loop5(key);
						}
					})();
				}
			}).catch(function (err) {
				console.log(err);
				return callback([]);
			});
		});
	}).catch(function (err) {
		callback([]);
	});
}

/**
 * opts에 origin 옵션의 true일 경우
 * 복사한 db에서 정보를 가져옴
 * @param dbname
 * @param res
 * @param callback
 */
function getOrigin(dbname, res, callback) {
	return mongodb.open('search', dbname).then(function (db) {
		var inOperation = [];

		for (var key in res) {
			var value = res[key];

			inOperation.push(value.key);
		}

		return db.find({ _id: { $in: inOperation } }).toArray(function (err, result) {
			if (err) {
				return console.log('Ooops!', err);
			}

			var _loop6 = function _loop6(i) {
				var doc = result[i];
				var n = res.find(function (o) {
					if (o.key == doc._id) return true;
				});

				doc.key = n.key;
				doc.sim = n.sim;
				doc.match = n.match;

				for (var _key5 in doc) {
					if (_key5.search('quizpath') != -1) {
						doc.quizpath = doc[_key5];
						break;
					}
				}

				result[i] = doc;
			};

			for (var i = 0; i < result.length; i++) {
				_loop6(i);
			}

			var newResult = [];

			var _loop7 = function _loop7(_key4) {
				var value = res[_key4];
				var item = result.find(function (o) {
					return o._id == value.key;
				});
				//console.log('sorting in origin', value, item);
				if (item != undefined) newResult.push(item);
			};

			for (var _key4 in res) {
				_loop7(_key4);
			}

			return callback(null, newResult);
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

function calRealSim(words, list) {
	var _loop8 = function _loop8(i) {
		var item = list[i];

		if (!item.tf) {
			item.realSim = -1;
			return 'continue';
		}

		var tf = (0, _keys2.default)(item.tf);
		var flag1 = false,
		    flag2 = false;
		tf = tf.filter(function (o) {
			if (o.indexOf(':') != -1) {
				flag1 = true;
			}

			if (flag1 && o.indexOf(':') == -1) {
				flag2 = true;
			}

			return flag2;
		});

		item.vecSim = similarityChecker.calSimilarityWithoutTF(words, tf);
	};

	for (var i = 0; i < list.length; i++) {
		var _ret9 = _loop8(i);

		if (_ret9 === 'continue') continue;
	}

	return list;
}

function getQuizInfoKeyword(quizInfo) {
	if (quizInfo == undefined) return [];

	var quizInfoKeywords = [];

	if (typeof quizInfo === "string") {
		try {
			var info = JSON.parse(quizInfo);
		} catch (e) {
			console.log('quiz info is not json format');
			return [];
		}
	} else {
		info = quizInfo;
	}

	for (var key in info) {
		var values = info[key];

		values = values.split(/\s*,\s*/);

		for (var index in values) {
			var quizInfoOne = values[index];
			if (quizInfoOne.split('-').length == 12) {
				//is classa
				quizInfoKeywords.push({
					className: key.toLowerCase(),
					value: quizInfoOne,
					isClass: true
				});
			} else {
				quizInfoKeywords.push({
					className: key.toLowerCase(),
					value: values[index],
					isClass: false
				});
			}
		}
	}

	return quizInfoKeywords;
}

function where(clause, callback) {
	return mongodb.open("search", "su_quizdoc_posting", false).then(function (collection) {
		return addIdKey(clause, collection, function (err, res) {
			if (err) return callback(err);
			return callback(undefined, res);
		});
	}).catch(function (err) {
		return callback(err);
	});
}

function addIdKey(obj, db, callback) {
	// -- key 는 무조건 하나
	var key = (0, _keys2.default)(obj)[0];
	var value = obj[key];
	var res = {};
	var isCalculated = false;
	var done = _.after(value.length, function () {
		return callback(undefined, res);
	});

	var _loop9 = function _loop9(index) {
		var filterKey = value[index];
		// -- or, and operation 계산
		var calculate = function calculate(err, result) {
			if (err) {
				console.log(err);
				return done();
			}

			if (isCalculated == false) {
				res = result;
				isCalculated = true;
				return done();
			}

			if (key == "$and") {
				// -- and 연산
				res = _.pick(res, _.keys(result));
			} else if (key == "$or") {
				// -- or 연산
				(0, _assign2.default)(res, result);
			}

			return done();
		};

		if (typeof filterKey == 'string') {
			// -- search db
			db.find({ _id: filterKey }).toArray(function (err, result) {
				if (err) {
					return calculate(err);
				}

				if (result.length == 0) {
					return calculate(undefined, {});
				}

				delete result[0]._id;
				return calculate(undefined, result[0]);
			});
		} else {
			// -- recursive
			return {
				v: addIdKey(filterKey, db, calculate)
			};
		}
	};

	for (var index in value) {
		var _ret10 = _loop9(index);

		if ((typeof _ret10 === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret10)) === "object") return _ret10.v;
	}
}

/**
 * 유사도 정렬을 방해하지 않으면서 pcode가 같은 경우 모아주는 알고리즘 O(n logn)
 * @param list
 * @param callback
 * @returns {*}
 */
function sorting(list, callback) {

	var increase = void 0;
	for (var i = 0; i < list.length; i += increase) {
		increase = 1;
		var quizOne = list[i];
		if (quizOne.pcode == '') continue;

		for (var j = i; j < list.length; j++) {
			var quizTwo = list[j];

			if (quizTwo.pcode == '') continue;

			if (quizOne.pcode == quizTwo.pcode) {
				list.splice(i, 0, quizTwo);
				list.splice(j, 1);
				increase++;
			}
		}
	}

	return callback(list);
}

/**
 * 사용자 검색 내역 저장
 * 실제 검색되는 키워드가 아닌 사용자가 직접 입력한 검색어 저장 (실험용, 2017.10.30)
 * @param dbName
 * @param searchWords
 * @param cb
 * @returns {*}
 */
function saveSearchWord(dbName, searchWords, cb) {
	return mongodb.open('search', dbName + "_search", true).then(function (collection) {
		var bulk = collection.initializeUnorderedBulkOp();

		for (var key in searchWords) {
			var val = searchWords[key];
			bulk.find({ _id: val }).upsert().update({ $inc: { 'term': 1 } });
		}

		return bulk.execute().then(function () {
			return cb();
		}).catch(function (err) {
			return cb(err);
		});
	}).catch(function (err) {
		return cb(err);
	});
}
//# sourceMappingURL=search.js.map
