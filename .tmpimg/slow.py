import urllib.request, json, os, time
UA={'User-Agent':'gym-app/1.0 (local static personal app build)'}
urls=json.load(open('.tmpimg/urls.json'))
todo=[f for f in urls if not (os.path.exists('.tmpimg/svg/'+f.replace(' ','_')) and os.path.getsize('.tmpimg/svg/'+f.replace(' ','_'))>500)]
print('осталось:',len(todo),flush=True)
rounds=0
while todo and rounds<40:
    rounds+=1
    got=[]
    for f in todo[:3]:
        dest='.tmpimg/svg/'+f.replace(' ','_')
        try:
            raw=urllib.request.urlopen(urllib.request.Request(urls[f].split('?')[0],headers=UA),timeout=60).read()
            open(dest,'wb').write(raw); got.append(f)
        except Exception: pass
        time.sleep(1.2)
    todo=[f for f in todo if f not in got]
    print('раунд',rounds,'+',len(got),'осталось',len(todo),flush=True)
    if todo: time.sleep(200)
print('ФИНАЛ осталось',len(todo),flush=True)
