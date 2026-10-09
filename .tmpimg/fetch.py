import urllib.request, urllib.parse, json, os, time, sys
UA={'User-Agent':'gym-app/1.0 (local static personal app build)'}
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
os.makedirs('.tmpimg/png', exist_ok=True)
urls=json.load(open('.tmpimg/urls.json'))
WIDTHS=(500,320,256,640,800,1024)
def grab(url, dest):
    d=os.path.dirname(url); n=os.path.basename(url); h=os.path.basename(d)
    wait=25
    for attempt in range(10):
        w=WIDTHS[attempt % len(WIDTHS)]
        thumb='%s/thumb/%s/%dpx-%s.png'%(d,h,w,n)
        try:
            raw=urllib.request.urlopen(urllib.request.Request(thumb,headers=UA),timeout=60).read()
            if len(raw)>1500:
                open(dest,'wb').write(raw); return True
            time.sleep(wait)
        except Exception:
            time.sleep(wait)
        wait=min(wait*2,240)
    return False
ok=0; bad=[]
for key,(f1,f2) in MAP.items():
    for f in (f1,f2):
        dest='.tmpimg/png/'+f.replace(' ','_')+'.png'
        if os.path.exists(dest) and os.path.getsize(dest)>1500: ok+=1; continue
        u=urls.get(f)
        if not u: bad.append(f); continue
        try:
            got=grab(u,dest)
        except Exception as ex:
            got=False
        if got: ok+=1; print('OK',f,flush=True)
        else: bad.append(f); print('BAD',f,flush=True)
print('ИТОГО',ok,'из',len(urls),'плохих:',bad,flush=True)
