import urllib.request, urllib.parse, json, os, time
UA={'User-Agent':'gym-app/1.0 (local static build)'}
MAP = {
 'dbFlat':('Bench press dumbbell 1.svg','Bench press dumbbell 2.svg'),
 'a3':('Incline dumbbell press 1.svg','Incline dumbbell press 2.svg'),
 'a1':('Machine bench press 1.svg','Machine bench press 2.svg'),
 'a5':('Butterfly machine 1.svg','Butterfly machine 2.svg'),
 'a2':('Wide grip lat pull down 1.svg','Wide grip lat pull down 2.svg'),
 'a4':('Cable-seated-rows-1.png','Cable-seated-rows-2.png'),
 'bRow':('Rear deltoid row dumbbell 1.svg','Rear deltoid row dumbbell 2.svg'),
 'c2':('Lateral dumbbell raises 1.svg','Lateral dumbbell raises 2.svg'),
 'c2c':('Bent over lateral cable raises 1.svg','Bent over lateral cable raises 2.svg'),
 'c4':('Cable crossover 1.svg','Cable crossover 2.svg'),
 'c6':('Preacher curl with machine 1.svg','Preacher curl with machine 2.svg'),
 'c5':('Triceps pushdown with rope and cable 1.svg','Triceps pushdown with rope and cable 2.svg'),
 'b1':('Hack squat machine 1.svg','Hack squat machine 2.svg'),
 'b2':('Lying leg curl machine 1.svg','Lying leg curl machine 2.svg'),
 'b3':('Leg extensions 1.svg','Leg extensions 2.svg'),
 'c8':('Seated calf raise using machine 1.svg','Seated calf raise using machine 2.svg'),
 'b6':('Calf raises with band 1.svg','Calf raises with band 2.svg'),
 'b5':('Hyperextensions 1.svg','Hyperextensions 2.svg'),
 'a6':('Side plank 1.svg','Side plank 2.svg'),
 'bul':('Lunges-1.png','Lunges-2.png'),
}
def api(params, tries=6):
    url="https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode(params)
    for i in range(tries):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=40))
        except Exception as e: print('api retry',e,flush=True); time.sleep(10*(i+1))
    return {}
titles=['File:'+f for p in MAP.values() for f in p]
urls={}
for i in range(0,len(titles),20):
    d=api({'action':'query','format':'json','prop':'imageinfo','iiprop':'url','titles':'|'.join(titles[i:i+20])})
    for pg in d.get('query',{}).get('pages',{}).values():
        if 'imageinfo' in pg: urls[pg['title'].replace('File:','')]=pg['imageinfo'][0]['url']
    time.sleep(4)
print('URL получено:',len(urls),flush=True)
json.dump(urls, open('.tmpimg/urls.json','w'))
os.makedirs('.tmpimg/png', exist_ok=True)
ok=0
for f,u in urls.items():
    dest='.tmpimg/png/'+f.replace(' ','_')+'.png'
    if os.path.exists(dest) and os.path.getsize(dest)>1000: ok+=1; continue
    base=u.split('?')[0]
    dirn=os.path.dirname(base)
    name=os.path.basename(base)
    thumb=dirn+'/thumb/'+dirn.split('/')[-1]+'/440px-'+name+'.png'
    for cand in (thumb,):
        try:
            raw=urllib.request.urlopen(urllib.request.Request(cand,headers=UA),timeout=45).read()
            open(dest,'wb').write(raw); ok+=1; break
        except Exception as e:
            print('thumb fail',f,e,flush=True); time.sleep(6)
    time.sleep(0.5)
print('ГОТОВО скачано миниатюр:',ok,flush=True)
