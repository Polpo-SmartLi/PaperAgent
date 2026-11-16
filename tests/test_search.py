import sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import paper_search as search
TITLE='Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks'
def record(title,doi='10.48550/arxiv.2005.11401'):
    return dict(title=title,doi=doi,year=2020,authors='Patrick Lewis et al.',venue='arXiv',source='DataCite')
class SearchTests(unittest.TestCase):
    def test_exact_title_rank_and_arxiv_link(self):
        with patch.object(search,'datacite',return_value=[record(TITLE)]),patch.object(search,'crossref',return_value=[record('Related retrieval generation research','10.1234/other')]):
            result=search.search_papers(TITLE.replace('-','–'))
        self.assertTrue(result['results'][0]['exact_match'])
        self.assertEqual(result['results'][0]['pdf_url'],'https://arxiv.org/pdf/2005.11401')
    def test_registry_failure_preserves_other_results(self):
        with patch.object(search,'datacite',return_value=[record(TITLE)]),patch.object(search,'crossref',side_effect=TimeoutError()):
            result=search.search_papers(TITLE)
        self.assertEqual(len(result['results']),1);self.assertTrue(result['warnings']);self.assertEqual(result['sources'],['DataCite'])
    def test_duplicate_titles_merge(self):
        with patch.object(search,'datacite',return_value=[record(TITLE)]),patch.object(search,'crossref',return_value=[record(TITLE.replace('-',' '),'10.1234/conference')]):
            result=search.search_papers(TITLE)
        self.assertEqual(len(result['results']),1)
    def test_identifiers(self):
        for query in ['2005.11401','arXiv:2005.11401','https://arxiv.org/pdf/2005.11401v2.pdf','https://doi.org/10.48550/arxiv.2005.11401']:
            self.assertEqual(search.identifier(query).lower(),'10.48550/arxiv.2005.11401')
    def test_all_sources_fail(self):
        with patch.object(search,'datacite',side_effect=TimeoutError()),patch.object(search,'crossref',side_effect=TimeoutError()):
            with self.assertRaises(ValueError):search.search_papers(TITLE)
if __name__=='__main__':unittest.main(verbosity=2)
