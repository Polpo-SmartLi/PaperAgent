import sys,unittest,json,sqlite3,threading,urllib.request,tempfile,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server as app
class ChatTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(dir=ROOT/'tmp');cls.old_db=app.DB;app.DB=Path(cls.temp.name)/'test.sqlite3'
        with sqlite3.connect(cls.old_db) as src,app.db() as c:
            for (sql,) in src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):c.execute(sql)
            for pid in ('paper-a','paper-b'):
                c.execute('INSERT INTO papers(id,title,pages) VALUES(?,?,?)',(pid,pid,2))
                c.executemany('INSERT INTO pages VALUES(?,?,?)',[(pid,1,'Attention enables the Transformer to process input sequences.'),(pid,2,'Multi-head attention uses parallel heads and learns representations.')])
        app.settings=lambda:{'api_key':'mock-local'}
        cls.messages=[]
        def fake_model(messages):
            cls.messages.append(messages)
            return '基于论文的回答 [E1]。'
        app.model=fake_model
        cls.http=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler);cls.url='http://127.0.0.1:'+str(cls.http.server_port)
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();app.DB=cls.old_db;cls.temp.cleanup()
    def call(self,path,data=None):
        raw=json.dumps(data).encode() if data is not None else None
        req=urllib.request.Request(self.url+path,data=raw,headers={'Host':'127.0.0.1:8765','Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=10) as r:return json.load(r)
    def test_multiturn_persistence_and_isolation(self):
        first=self.call('/api/ask',{'paper':'paper-a','question':'Explain attention.'})
        second=self.call('/api/ask',{'paper':'paper-a','question':'Why does it use multiple heads?'})
        history=self.call('/api/chat?paper=paper-a')
        self.assertEqual(len(history),2);self.assertEqual([x['id'] for x in history],[first['id'],second['id']])
        self.assertEqual(history[0]['question'],'Explain attention.');self.assertEqual(history[1]['evidence'],second['evidence'])
        messages=self.messages[-1];self.assertEqual([x['role'] for x in messages],['system','user','assistant','user'])
        self.assertEqual(messages[1]['content'],'Explain attention.');self.assertIn('multiple heads',messages[-1]['content'])
        self.assertTrue(all(1<=e['page']<=2 for e in second['evidence']))
        self.assertEqual(self.call('/api/chat?paper=paper-b'),[])
        # A fresh DB connection retrieves the same full history, independent of browser state.
        self.assertEqual(len(app.chat_history('paper-a')),2)
    def test_general_assistant_without_paper(self):
        self.assertEqual(self.call('/api/assistant'),[])
        self.call('/api/assistant',{'question':'What is a neural network?'})
        self.call('/api/assistant',{'question':'Explain it more simply.'})
        history=self.call('/api/assistant')
        self.assertEqual(len(history),2)
        self.assertEqual(history[0]['question'],'What is a neural network?')
        self.assertEqual([m['role'] for m in self.messages[-1]],['system','user','assistant','user'])
        self.assertEqual(self.messages[-1][1]['content'],'What is a neural network?')
        self.assertNotIn('本轮候选原文',self.messages[-1][-1]['content'])
        self.assertEqual(self.call('/api/chat?paper=paper-b'),[])

    def test_failure_does_not_corrupt_history(self):
        original=app.model
        def fail(_):raise ValueError('模拟网络错误')
        app.model=fail
        try:
            with self.assertRaises(urllib.error.HTTPError):self.call('/api/ask',{'paper':'paper-b','question':'failed turn'})
            self.assertEqual(self.call('/api/chat?paper=paper-b'),[])
        finally:app.model=original
if __name__=='__main__':unittest.main(verbosity=2)
