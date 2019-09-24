/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/searchs              ->  index
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.index = index;
exports.search = search;
var searcher = require('../../components/searchers/search');
var logger = require('../../components/loggers/logger');

// Gets a list of Searchs
function index(req, res) {
	res.json([]);
}

/**
 * req에 포함된 파라메터
 - q : 질의 Text
 - name : 색인 DB 명
 - start : 페이징 시작 index
 - limit : 페이징 갯수
 - origin : 원본 데이터 (default : ```false```)
 - quizInfo : 분류 내용 (class1, class2 ... 등의 분류 내용)
 - groupby : 그룹핑
 - group : 그룹문항 별로 정렬 여부
 - full : 검색어 전체 일치 여부 (default : ```false```, ```true```설정시 AND 검색, ```false```일 경우 약 70% 일치해야 가져옴)
 * @param req
 * @param res
 */
function search(req, res) {
	// 검색 호출
	return searcher.saveSearchWord(req.body.name, req.body.q.split(' '), function (err) {
		if (err) // 에러가 나도 무시함
			console.log(err);

		return searcher.search(req.body, function (err, out) {
			// 검색 호출
			if (err) {
				logger.log('error', 'Search : search fail\n' + err.message);
				return res.json({
					result: 'error',
					message: err.message
				});
			}

			logger.log('info', 'Search : search success\ncount - ' + out.count + "\npage - " + out.page);

			res.json(out); // 결과 리턴
		});
	});
}
//# sourceMappingURL=search.controller.js.map
