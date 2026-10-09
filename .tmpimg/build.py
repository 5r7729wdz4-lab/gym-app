# Сборка frames.js из скачанных SVG: минификация + перекраска под тёмную тему
import os, re, json, html
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
def read(f):
    p='.tmpimg/svg/'+f.replace(' ','_')
    if not os.path.exists(p) or os.path.getsize(p)<500: return None
    if f.lower().endswith('.png'):
        import base64
        return 'DATA:'+base64.b64encode(open(p,'rb').read()).decode()
    return open(p,encoding='utf-8',errors='ignore').read()

def clean(raw):
    if raw.startswith('DATA:'): return raw
    """убираем размеры, оставляем viewBox; красим в светлый"""
    m=re.search(r'viewBox="([^"]+)"',raw)
    vb=m.group(1) if m else '0 0 100 100'
    s=raw[raw.index('<svg'):]
    s=s[:s.index('</svg>')]
    # убираем <?xml?>, DOCTYPE, комментарии
    s=re.sub(r'<!--.*?-->','',s,flags=re.S)
    s=re.sub(r'\s(width|height)="[^"]*"','',s)
    s=re.sub(r'\s+',' ',s).strip()
    s=s.replace('<svg','<svg',1)
    # красим: чёрный -> светлый, и задаём fill по умолчанию
    s=re.sub(r'fill="#000000"',  'fill="#EDEDF2"', s)
    s=re.sub(r'fill="#000"',      'fill="#EDEDF2"', s)
    s=re.sub(r'fill="black"',     'fill="#EDEDF2"', s)
    s=re.sub(r'fill="rgb\(0,0,0\)"','fill="#EDEDF2"', s)
    s=re.sub(r'stroke="#000000"', 'stroke="#EDEDF2"',s)
    s=re.sub(r'stroke="#000"',     'stroke="#EDEDF2"',s)
    s=re.sub(r'stroke="black"',   'stroke="#EDEDF2"',s)
    # вставляем fill на корень, если пути без явного fill
    s=s.replace('<svg ', '<svg fill="#EDEDF2" ',1) if 'fill="#EDEDF2"' not in s[:400] else s
    s=s.replace('<svg', '<svg viewBox="%s" preserveAspectRatio="xMidYMid meet"'%vb, 1)
    return s

out={}; done=[]
for k,(f1,f2) in MAP.items():
    a,b=read(f1),read(f2)
    if a and b:
        out[k]=[clean(a),clean(b)]; done.append(k)
print('готово упражнений:',len(done),'->',done)
if not done:
    raise SystemExit
body="'use strict';\n/* Схемы упражнений: Wikimedia Commons, автор Everkinetic, CC BY-SA 3.0 */\nvar FRAMES = {\n"
for k,(a,b) in out.items():
    body+=" %s:[\n  '%s',\n  '%s'\n ],\n"%(k,a.replace("'","\\'"),b.replace("'","\\'"))
body+="};\n"
open('frames.js','w',encoding='utf-8').write(body)
print('frames.js:',round(len(body)/1024),'КБ для',len(done),'упражнений')
json.dump(sorted(done), open('.tmpimg/done.json','w'))
