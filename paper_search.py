"""Search independent DOI registries and merge title-ranked results."""
import concurrent.futures
import difflib
import json
import re
import unicodedata
import urllib.parse
import urllib.request


def title_key(value):
    return ''.join(c for c in unicodedata.normalize('NFKC', value).casefold() if c.isalnum())


def fetch_json(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'PaperAgent/0.3 (local academic reader)', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def identifier(query):
    value = query.strip()
    doi = re.fullmatch(r'(?:https?://(?:dx\.)?doi\.org/|doi:\s*)?(10\.\d{4,9}/\S+)', value, re.I)
    if doi:
        return doi.group(1)
    arxiv = re.fullmatch(r'(?:https?://arxiv\.org/(?:abs|pdf)/|arxiv:\s*)?(\d{4}\.\d{4,5}|[a-z-]+/\d{7})(?:v\d+)?(?:\.pdf)?', value, re.I)
    return '10.48550/arxiv.' + arxiv.group(1) if arxiv else None


def crossref(query, doi):
    url = 'https://api.crossref.org/works'
    if doi:
        records = [fetch_json(url + '/' + urllib.parse.quote(doi, safe=''))['message']]
    else:
        records = fetch_json(url + '?' + urllib.parse.urlencode({'query.title': query, 'rows': 20}))['message']['items']
    result = []
    for item in records:
        if not item.get('DOI') or not item.get('title'):
            continue
        date = (item.get('published', {}).get('date-parts') or [['']])[0]
        result.append({'title': item['title'][0], 'doi': item['DOI'], 'year': date[0] if date else '',
                       'authors': ', '.join((a.get('given', '') + ' ' + a.get('family', '')).strip() for a in item.get('author', [])[:5]),
                       'venue': (item.get('container-title') or [''])[0], 'source': 'Crossref'})
    return result


def datacite(query, doi):
    url = 'https://api.datacite.org/dois'
    if doi:
        records = [fetch_json(url + '/' + urllib.parse.quote(doi, safe=''))['data']]
    else:
        # Quote each literal token so user punctuation cannot change query syntax.
        terms = re.findall(r'[^\W_]+', unicodedata.normalize('NFKC', query), re.UNICODE)[:35]
        if not terms:
            return []
        title_query = 'titles.title:(' + ' AND '.join('"' + token + '"' for token in terms) + ')'
        records = fetch_json(url + '?' + urllib.parse.urlencode({'query': title_query, 'page[size]': 20}))['data']
    result = []
    for record in records:
        item = record.get('attributes') or {}
        titles = item.get('titles') or []
        doi_value = item.get('doi') or record.get('id')
        if not titles or not doi_value:
            continue
        result.append({'title': titles[0].get('title', ''), 'doi': doi_value, 'year': item.get('publicationYear', ''),
                       'authors': ', '.join(a.get('name') or (a.get('givenName', '') + ' ' + a.get('familyName', '')).strip() for a in (item.get('creators') or [])[:5]),
                       'venue': item.get('publisher') or '', 'source': 'DataCite'})
    return result


def search_papers(query):
    query = ' '.join(query.strip().split())[:300]
    if not query:
        raise ValueError('请输入论文标题、关键词或标识符')
    doi = identifier(query)
    results, warnings, sources = [], [], []
    def run(provider):
        name, function = provider
        try:
            return name, function(query, doi), None
        except Exception as error:
            code = getattr(error, 'code', None)
            return name, [], 'HTTP ' + str(code) if code else '连接失败或超时'
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for name, records, error in pool.map(run, [('DataCite', datacite), ('Crossref', crossref)]):
            if error:
                # A DOI belongs to one registry; absence from the other is expected.
                if not (doi and error == 'HTTP 404'):
                    warnings.append(name + '：' + error)
            else:
                sources.append(name)
                results.extend(records)
    if not sources:
        raise ValueError('论文搜索源暂时不可用，请稍后重试。' + '；'.join(warnings))
    merged, seen_doi, seen_title = [], {}, {}
    for item in results:
        key, doi_key = title_key(item['title']), item['doi'].casefold()
        arxiv = re.fullmatch(r'10\.48550/arxiv\.(.+)', doi_key)
        item['url'] = 'https://doi.org/' + urllib.parse.quote(item['doi'], safe='/')
        item['pdf_url'] = ''
        if arxiv:
            paper_id = arxiv.group(1)
            item.update(url='https://arxiv.org/abs/' + paper_id, pdf_url='https://arxiv.org/pdf/' + paper_id, source='arXiv · DataCite')
        existing = seen_doi.get(doi_key) or seen_title.get(key)
        if existing is not None:
            existing['source'] += ' / ' + item['source']
            if item['pdf_url'] and not existing['pdf_url']:
                existing.update(url=item['url'], pdf_url=item['pdf_url'])
            seen_doi[doi_key] = existing
            continue
        merged.append(item)
        seen_doi[doi_key] = item
        if key:
            seen_title[key] = item
    query_key = title_key(query)
    query_words = set(re.findall(r'[^\W_]+', query.casefold()))
    def rank(item):
        key = title_key(item['title'])
        item['exact_match'] = (key == query_key) or bool(doi and item['doi'].casefold() == doi.casefold())
        words = set(re.findall(r'[^\W_]+', item['title'].casefold()))
        coverage = len(query_words & words) / max(1, len(query_words))
        return (item['exact_match'], coverage, difflib.SequenceMatcher(None, query_key, key).ratio())
    merged.sort(key=rank, reverse=True)
    return {'results': merged[:20], 'warnings': warnings, 'sources': sources}
