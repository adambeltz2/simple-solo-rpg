"""Assemble src/*.js, style.css and template.html into the single-file app (../index.html)."""
import os, json, datetime
here = os.path.dirname(os.path.abspath(__file__))
order = ['00_util','01_data','01b_art','02_hero','03_adventure','04_play','04b_dice','05_flow','06_combat','07_end','08_ai','09_ui']
js = "(function(){\n'use strict';\n" + "\n".join(open(os.path.join(here, n + '.js')).read() for n in order) + "\n})();\n"
assert '</script' not in js.lower()
css = open(os.path.join(here, 'style.css')).read()
tpl = open(os.path.join(here, 'template.html')).read()
version = json.load(open(os.path.join(here, '..', 'package.json')))['version']
js = js.replace('__VERSION__', version).replace('__BUILD__', datetime.date.today().isoformat())
out = tpl.replace('/*CSS*/', css).replace('/*JS*/', js)
dest = os.path.join(here, '..', 'index.html')
open(dest, 'w').write(out)
print('built', len(out), 'bytes')
