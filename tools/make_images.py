"""Regenerate js/images.js from assets/rick.png, koala.png, logo.png (run from project root: python tools/make_images.py)"""
import base64, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
b = lambda n: 'data:image/png;base64,' + base64.b64encode((R/'assets'/n).read_bytes()).decode()
(R/'js/images.js').write_text("/* Embedded images. Regenerate with: python tools/make_images.py */\nconst IMG = {rick:'%s', koala:'%s', logo:'%s'};\n" % (b('rick.png'), b('koala.png'), b('logo.png')))
print('js/images.js updated')
