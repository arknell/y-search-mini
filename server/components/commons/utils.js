/**
 * 검색엔진 여러 곳에서 사용할 가능성이 높은 유틸성 library
 * 1. term frequency 계산
 * 2. 질의 벡터 생성
 * 3. text 문서에서 text 추출
 * 4. 두개의 object 합병
 * 5. 여러개의 벡터 순위화
 *
 * @author Saebyeok Lee
 * @since 0.1.0
 */

"use strict";

var _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    _similarity = require('compute-cosine-similarity'); // 코사인 유사도 계산 라이브러리
var logger = require('../loggers/logger');
var request = require('request');

// -- node-java의 경우 하나의 모듈을 사용해야함.
// -- 서로 다른 모듈을 사용했을 경우 프로그램이 죽음 (캐치 못함)

/**
 * Term Frequency 계산식 (증가 빈도)
 * -- 참고 : http://dev.youngkyu.kr/25
 * @param freq
 * @param max
 * @returns {number}
 */
function termFrequency(freq, max) {
	return 0.5 + 0.5 * (freq / max); // 1 + Math.log(val);
}

/**
 * 두개의 Object를 합병
 * 안에 있는 값의 키가 같을 경우 sum
 * @param {Object} o1
 * @param {Object} o2
 * @returns {*}
 */
function mergeSumObj(o1, o2) {
	if (o1 == undefined || o2 == undefined) return o1;

	if (!o1 instanceof Object || !o2 instanceof Object) {
		return o1;
	}

	return _.defaults(_(o1).forEach(function (val, key) {
		//key가 숫자일 경우 integer로 검사되던 버그 수정 (2017.04.28)
		key = key + "";
		if (key in o2) {
			if (o2[key] instanceof Object && val instanceof Object) {
				o1[key] = mergeSumObj(val, o2[key]);
			} else if (typeof o2[key] === 'number' && typeof val === 'number') {
				o1[key] = val + o2[key];
			}
		}
	}), o2);
}

function mergeMinusSumObj(o1, o2) {
	if (o1 == undefined || o2 == undefined) return o1;

	if (!o1 instanceof Object || !o2 instanceof Object) {
		return o1;
	}

	return _.defaults(_(o1).forEach(function (val, key) {
		//key가 숫자일 경우 integer로 검사되던 버그 수정 (2017.04.28)
		key = key + "";
		if (key in o2) {
			if (o2[key] instanceof Object && val instanceof Object) {
				o1[key] = mergeMinusSumObj(val, o2[key]);
			} else if (typeof o2[key] === 'number' && typeof val === 'number') {
				o1[key] = val - o2[key];
				if (o1[key] < 1) {
					delete o1[key];
				}
			}
		}
	}), o2);
}

module.exports = {
	/**
  * 비동기 방식으로 filepath의 text를 가져옴
  * pdf, txt 지원
  * @param apiurl
  * @param filepath
  * @param callback
  */
	getTextFromFile: function getTextFromFile(apiurl, filepath, callback) {
		return request({
			uri: apiurl + '/read.dox',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'charset': 'utf-8'
			},
			json: { path: filepath }
		}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				if (body.result == 'success') {
					return callback(null, body.data);
				} else {
					return callback({ message: body.message, errMessage: body.errMessage });
				}
			}
		});
	},

	/**
  * 단어 배열로 부터 term frequency 를 계산함
  * @param words
  * @param opts  // 'all', 'tf', 'freq' 중 하나 값
  * @returns {{}}
  */
	tf: function tf(words, opts) {
		opts = opts || 'all';
		var temp = _.countBy(words, _.identity); // 중복 단어들을 counting

		if (opts === 'freq') {
			return temp;
		}

		var max = _.max(_.values(temp)); // 최빈값 (최대 빈도 단어의 수)
		var bow = {};

		for (var key in temp) {
			var val = temp[key];
			if (opts === 'all') {
				// opts에 따라 결과의 형태가 달라짐
				bow[key] = {
					tf: termFrequency(val, max),
					freq: val
				};
			} else {
				// tf
				bow[key] = termFrequency(val, max);
			}
		}

		return bow;
	},
	mergeSumObj: mergeSumObj,
	mergeMinusSumObj: mergeMinusSumObj,
	/**
  * 질의어들을 문서 벡터처럼 표현
  * @param tf
  * @param idf
  * @returns {Array}
  */
	queryToVector: function queryToVector(tf, idf) {
		var array = _.toArray(tf);
		var max = 0; // 최빈 단어의 count
		var vector = new Array(_.size(tf)); // 빈 벡터(배열) 생성
		var i = 0;

		for (var _i = 0; _i < array.length; _i++) {
			if (array[_i].count >= max) max = array[_i].count;
		}

		_(tf).forEach(function (val) {
			vector[i] = termFrequency(val.count, max) * idf[i].idf; // tf 값 계산하여 각 위치에 대입
			i = i + 1;
		});

		return vector; // [1.32, 0.73, 9.33, ... ]
	},
	/**
  * 코사인 유사도만 계산
  * @param vec1
  * @param vec2
  * @returns {Number|Null}
  */
	similarity: function similarity(vec1, vec2) {
		return _similarity(vec1, vec2);
	},
	/**
  * cosine 유사도에 의한 Ranking 알고리즘
  * @param q
  * @param docs
  * @returns {Array}
  */
	ranking: function ranking(q, docs) {
		var rank = [];
		//console.log(docs);
		_(docs).forEach(function (vector, key) {
			var max = Math.max(q.length, vector.length);

			for (var i = 0; i < max; i++) {
				if (i >= q.length) {
					q.push(0.0);
				}

				if (i >= vector.length) {
					vector.push(0.0);
				}
			}

			var sim = _similarity(q, vector); // 질의 q와 문서의 cosine 유사도 계산 (모듈로 대체)
			rank.push({
				key: key,
				sim: sim > 1 ? 1 : sim.toFixed(4) // 유사도는 소수점 4자리 까지 표시
			});
		});

		return _.orderBy(rank, ['sim'], ['desc']); // 유사도 순으로 정렬
	},
	rankingWithoutZeroKey: function rankingWithoutZeroKey(q, docs) {
		var rank = [];
		//console.log(docs);
		_(docs).forEach(function (vector, key) {
			var max = Math.max(q.length, vector.length);
			var removeIndices = [];
			for (var i = 0; i < max; i++) {
				if (i >= q.length) {
					q.push(0.0);
				}

				if (i >= vector.length) {
					vector.push(0.0);
				}

				if (q[i] == 0 && vector[i] == 0) removeIndices.push(i);
			}

			var newQ = q.slice(0);
			var newVector = vector.slice(0);

			for (var _i2 = 0; _i2 < removeIndices.length; _i2++) {
				newQ.splice(removeIndices[_i2], 1);
				newVector.splice(removeIndices[_i2], 1);
			}

			var sim = _similarity(newQ, newVector); // 질의 q와 문서의 cosine 유사도 계산 (모듈로 대체)
			rank.push({
				key: key,
				sim: sim > 1 ? 1 : sim.toFixed(4) // 유사도는 소수점 4자리 까지 표시
			});
		});

		return _.orderBy(rank, ['sim'], ['desc']); // 유사도 순으로 정렬
	},
	errorHandler: function errorHandler(msg, callback) {
		var err = new Error(msg);
		//console.error(err);
		callback(err);
	}
};
//# sourceMappingURL=utils.js.map
